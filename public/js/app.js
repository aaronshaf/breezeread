(function ($,_,FastClick) {
	"use strict";
	
	_.templateSettings = {
		interpolate : /\{\{(.+?)\}\}/g
	};

	String.prototype.htmlEntities = function () {
		return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
	};

	$(function() {
		var is_touch_device = 'ontouchstart' in document.documentElement;

		var fontSize = localStorage.getItem('fontSize');
		if(fontSize) {
			fontSize = JSON.parse(fontSize);
		} else {
			fontSize = 24;
		}
		var fontFamilies = [
			"'Calibri', Arial', sans-serif",
			"'Cambria', 'Times', serif",
			"'Cinzel', cursive"
		];
		var fontFamily = localStorage.getItem('fontFamily');
		if(!fontFamily) {
			fontFamily = fontFamilies[0];
		}

		var saveFont = function() {
			localStorage.setItem('fontSize',fontSize);
			localStorage.setItem('fontFamily',fontFamily);
		};
		saveFont();

		var center = function() {
			var top = ($(window).height() / 2) - ($(window.concentrated).height() / 2);
			$(window.concentrated).css({
				//top: $(window.navbar).height() + (($(window).height() - $(window.navbar).height()) / 2) - $(window.concentrated).height() / 2
				top: top + 'px'
			});
		};

		var updateFont = function() {
			$(window.fontFamilies).css({
				fontSize: fontSize + 'px',
				lineHeight: (fontSize * 1.7) + 'px'
			});
			$(window.readView).css({
				fontSize: fontSize + 'px',
				fontFamily: fontFamily
			});
			center();
		};
		updateFont();

		var Articles = {
			save: function(article) {
				if(!article._id) {
					article._id = Math.floor(Math.random() * 0x1000000).toString(16);
				}
				if(!article.progress) {
					article.progress = 0;
				}
				article.content = article.content.replace(/\n/g, " "); //Remove line breaks
				article.content = article.content.replace(/ +(?= )/g,''); //Remove multiple spaces
				window.localStorage.setItem(article._id,JSON.stringify(article));
				//$.post('/a/' + article._id,article);

				var articles = window.localStorage.getItem('articles');
				if(articles) {
					articles = JSON.parse(articles);
				} else {
					articles = [];
				}

				articles.push(article._id);
				articles = _.uniq(articles);
				window.localStorage.setItem('articles',JSON.stringify(articles));

				return article;
			},

			remove: function(id) {
				window.localStorage.removeItem(id);

				var articles = localStorage.getItem('articles');
				if(articles) {
					articles = JSON.parse(articles);
				} else {
					return true;
				}
				
				articles = _.without(articles,id);
				localStorage.setItem('articles',JSON.stringify(articles));
			},

			find: function() {
				var articles = localStorage.getItem('articles');
				if(articles) {
					return JSON.parse(articles);
				} else {
					return [];
				}
			},

			findOne: function(id) {
				var article = window.localStorage.getItem(id);
				if(article) {
					article = JSON.parse(article);
				} else {
					//$.getJSON('/a/' + uid, function(data) {
					//	localStorage.setItem(uid,JSON.stringify(data));

					//});
				}

				return article;
			}
		};

		var Breezeread = _.bindAll({
			initialize: function() {
				var articles = Articles.find();
				if(articles.length) {
					this.list();
				} else {
					this.add();
				}
			},

			list: function() {
				var articles = Articles.find();
				if(!articles.length) {
					return Breezeread.add();
				}

				$('.view').hide();
				$(window.listView).show();
				$(window.addButton).show();
				$(window.saveButton).hide();

				var tbody = $(window.listView).find('tbody');
				tbody.empty();
				var template = _.template($(window.articleListingTemplate).html());
				articles.forEach(function(article) {
					article = Articles.findOne(article);
					var words = article.content.split(' ');
					var preview = words.slice(0,100);
					var previewString = preview.join(' ').htmlEntities();
					if(preview.length < words.length) {
						previewString += '...';
					}
					tr = $(template({preview:previewString}));
					tr.data('article_id',article._id);
					tr.off('click');
					tr.on('click',function() {
						Breezeread.read($(this).data('article_id'));
					});
					var tr = tbody.append(tr);
				});
				return false;
			},

			read: function(id) {
				$('.view').hide();
				$(window.readView).show();
				this.readConcentrated(id); //Only one supported for now
			},

			readConcentrated: function(id) {
				var characterWidth = 20;
				var lines = [];
				var article = Articles.findOne(id);

				if(!article) {return;}

				var words = article.content.split(' ');
				var line = "", word;
				while(words.length) {
					word = words.shift();
					if(line.length + 1 + word.length <= characterWidth) {
						line = line + " " + word;
					} else {
						lines.push(line.trim());
						line = word;
					}
				}
				lines.push(line.trim());

				$('.readMode').hide();
				$(window.concentrated).show();

				var progress = function() {
					$(window.progressInner).css({
						width: (100 * ((article.progress + 1) / lines.length)) + '%'
					});
				};
				progress();

				$(window).off('resize');
				$(window).on('resize',center);
				center();

				$(window.concentrated).html(lines[article.progress]);

				$(document).off('keydown');
				$(document).on('keydown',function(e) {
					if(_.indexOf([39,40,75],e.keyCode) !== -1) {
						article.progress++;
						if(article.progress > lines.length - 1) {
							article.progress = lines.length - 1;
						}
						$(window.concentrated).html(lines[article.progress]);
						Articles.save(article);
						progress();
						return false;
					} else if(_.indexOf([37,38,74],e.keyCode) !== -1) {
						article.progress--;
						if(article.progress < 0) {
							article.progress = 0;
						}
						$(window.concentrated).html(lines[article.progress]);
						Articles.save(article);
						progress();
						return false;
					} else if(_.indexOf([8],e.keyCode) !== -1) {
						Articles.remove(article._id);
						Breezeread.list();
						return false;
					}
				});
			},

			save: function(event) {
				event.preventDefault();

				if(!window.newArticleContent.value.trim().length) return false;

				var article = Articles.save({
					content: window.newArticleContent.value.trim()
				});
				window.newArticleContent.value = '';
				$(window.addButton).show();
				$(window.saveButton).hide();
				this.read(article._id);
			},

			settings: function() {
				$('.view').hide();
				$(window.settingsView).show();

				$(window.fontFamilies).empty();
				fontFamilies.forEach(function(_fontFamily) {
					var div = $('<div>The quick brown fox jumps over the lazy dog.</div>');
					div.addClass('fontFamily');
					div.css({fontFamily: _fontFamily});
					div.data('fontFamily',_fontFamily);
					div.on('click',function() {
						fontFamily = $(this).data('fontFamily');
						saveFont();
						$('.fontFamily.active').removeClass('active');
						$(this).addClass('active');
						updateFont();
					});
					if(fontFamily === _fontFamily) {
						div.addClass('active');
					}
					$(window.fontFamilies).append(div);
				});

				$(window.fontSize).on('input',function() {
					fontSize = parseFloat($(this).val());
					updateFont();
					saveFont();
				});
				$(window.fontSize).val(fontSize);
				updateFont();
			},

			add: function() {
				$('.view').hide();

				$(window.addView).show();
				$(window.addButton).hide();

				if($('textarea').val().length) {
					$(window.saveButton).show();
				} else {
					$(window.saveButton).hide();
				}
				
				//$(document).off('keydown',Breezeread.processKeydown);

				function resizeTextarea() {
					$('textarea').height($(window).height() - $('textarea').offset().top - ($('textarea').offset().top - $('.navbar').height()));
				}
				resizeTextarea();

				$(document).off('keydown');
				$(document).on('keydown',function(e) {
					if(e.shiftKey && e.keyCode === 13) {
						$(window.saveButton).trigger('click');
					}
				});

				$(document).off('input');
				$(document).on('input',function(e) {
					if($('textarea').val().length) {
						$(window.saveButton).show();
					} else {
						$(window.saveButton).hide();
					}
				});

				$(window).off('resize');
				$(window).on('resize',resizeTextarea);

				$('textarea').focus();

				return false;
			}
		});
		Breezeread.initialize();

		$(window.addButton).click(Breezeread.add);
		$(window.saveButton).click(Breezeread.save);
		$(window.settingsButton).click(Breezeread.settings);
		$(window.listButton).click(Breezeread.list);

		new FastClick(document.body);
	});
}($,_,FastClick));

/*
Mode
	Concentrated
	Columned
	Continuous
Font
Font size
Columns*
Width*
*/

