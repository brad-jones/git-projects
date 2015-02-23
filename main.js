/*
 * Copyright (c) 2015 Brad Jones
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

define(function (require, exports, module)
{
	// Import some modules
	var
		AppInit = brackets.getModule('utils/AppInit'),
		FileUtils = brackets.getModule('file/FileUtils'),
		FileSystem = brackets.getModule('filesystem/FileSystem'),
		PreferencesManager = brackets.getModule('preferences/PreferencesManager'),
		ProjectManager = brackets.getModule('project/ProjectManager'),
		Dialogs = brackets.getModule('widgets/Dialogs'),
		ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
		CommandManager = brackets.getModule("command/CommandManager"),
		Menus = brackets.getModule("command/Menus"),
		QuickOpen = brackets.getModule("search/QuickOpen")
	;

	// Define some constants
	var
		HUMAN_NAME = 'Git Projects',
		COMP_NAME = 'git-projects',
		LIST_COMMAND = COMP_NAME + '.list',
		QUICK_OPEN_PREFIX = ':',
		LIST_COMMAND_SHORTCUT = 'Alt-P'
	;

	// Load our custom styles
	ExtensionUtils.loadStyleSheet(module, "styles.less");

	// Register our command
	CommandManager.register(HUMAN_NAME, LIST_COMMAND, function()
	{
		QuickOpen.beginSearch(QUICK_OPEN_PREFIX);
	});

	// And add our menu item
	var menu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
	menu.addMenuItem(LIST_COMMAND, LIST_COMMAND_SHORTCUT);

	/**
	 * Preferences
	 *
	 * This section of code will load our extension preferences.
	 * If the base path is undefined we will show the first-run modal.
	 */
	var prefs = PreferencesManager.getExtensionPrefs(COMP_NAME);
	var viewState = PreferencesManager.stateManager.getPrefixedSystem(COMP_NAME);

	if (prefs.get("maxDepth") === undefined) prefs.set("maxDepth", 2);

	if (prefs.get("basePath") === undefined)
	{
		// Show the first run modal
		var firstRunDialog = Dialogs.showModalDialogUsingTemplate
		(
			require('text!./modals/first-run.html'),	// grab modal html
			false										// do not auto dismiss
		);

		// Set the placeholder based on the OS we are running on
		// This may provide an additonal hint to help windows users.
		switch (whatOs())
		{
			case 'WIN': var placeholder = 'C:\\Base\\Path'; break;
			default: var placeholder = '/base/path';
		}

		$('.'+COMP_NAME+' input.base-path').prop('placeholder', placeholder);

		// Browse Button Handler
		$('.'+COMP_NAME+' button.browse').click(function(event)
		{
			FileSystem.showOpenDialog
			(
				false,						// dont allow multiple selections
				true,						// pick folders not files
				'Git Projects: Base Path',	// dialog title
				null,						// show the last browsed folder
				null,						// N/A when picking folders
				function(err, dir)			// dialog callback
				{
					if (dir[0] !== undefined)
					{
						$('.'+COMP_NAME+' input.base-path').val(dir[0]);
					}
				}
			);
		});

		// Cancel Button Handler
		$('.'+COMP_NAME+' button.cancel').click(function(event)
		{
			firstRunDialog.close();

			Dialogs.showModalDialog
			(
				COMP_NAME+'-error',
				'Opps: You did not complete the Git Projects Setup',
				'\
					Without the base path set, this extension is pretty useless,\
					however you may set it manually in your Prefrences File.\
					Also please note that until the Base Path is set you will\
					continue to get this popup everytime you start Brackets.\
				'
			);
		});

		// Save Button Handler
		$('.'+COMP_NAME+' button.save').click(function(event)
		{
			var path = $('.'+COMP_NAME+' input.base-path').val();

			// Fixes: brad-jones/git-projects#2
			// Convert windows paths to unix style
			path = FileUtils.convertWindowsPathToUnixPath(path);

			try
			{
				FileSystem.resolve(path, function(err, dir, stat)
				{
					if (err == 'NotFound')
					{
						Dialogs.showModalDialog
						(
							COMP_NAME+'-error',
							'Opps: Path Not Found',
							'The path you specfied does not exist on your system!'
						);
					}
					else
					{
						firstRunDialog.close();

						// ensure trailing slash - this is important
						if (path.substr(-1,1) != '/') path = path + '/';

						prefs.set("basePath", path);
						prefs.save();
					}
				});
			}
			catch (Exception)
			{
				Dialogs.showModalDialog
				(
					COMP_NAME+'-error',
					'Opps: Your Path was Not Valid',
					'Paths must be absolute, relative paths are not allowed!'
				);
			}
		});
	}

	/**
	 * Quick Open Plugin
	 *
	 * This is where expose the functionality of this extension.
	 */
	QuickOpen.addQuickOpenPlugin
	({
		name: COMP_NAME,
		label: HUMAN_NAME,  // ignored before Sprint 34
		languageIds: [],  // empty array = all file types  (Sprint 23+)
		fileTypes:   [],  // (< Sprint 23)
		done: function () {},
		search: function(query, matcher)
		{
			var matches = [];

			// lose the custom prefix
			query = query.substr(1);

			// Use the string matcher on each project
			$.each(getProjects(), function(key, value)
			{
				if (matcher.match(value, query))
				{
					matches.push(value);
				}
			});

			return matches;
		},
		match: function(query)
		{
			if (query.indexOf(QUICK_OPEN_PREFIX) === 0)
			{
				return true;
			}
		},
		itemSelect: function(item)
		{
			ProjectManager.openProject(item);
		}
	});

	/**
	 * Get the Projects List
	 *
	 * @returns {array} An array of project paths.
	 */
	function getProjects()
	{
		return viewState.get("projects") || [];
	}

	/**
	 * Add a new project path to the Projects List
	 *
	 * @param {string} path The path of the new project.
	 *
	 * @returns {void}
	 */
	function addProject(path)
	{
		viewState.set("projects", $.unique($.merge(getProjects(), [path])));
	}

	/**
	 * Find All Git Repos
	 *
	 * This searches recursively below the ```BASE_PATH``` up to ```MAX_DEPTH```
	 * for folders that contain a git repository. If it does we add that folder
	 * the recent projects list.
	 *
	 * @param {filesystem.Directory} The directory to start searching in.
	 *
	 * @returns {void}
	 */
	function findGitProjects(path)
	{
		path.getContents(function(err, contents)
		{
			for (var i = 0; i < contents.length; i++)
			{
				var dir = contents[i];

				if (dir.isDirectory)
				{
					if (dir.name == '.git')
					{
						// we found a repo so lets add it to our project list
						addProject(dir.parentPath);
					}
					else
					{
						// Calculate the folder depth that we are currently at
						var depth = dir.fullPath;
						depth = depth.replace(prefs.get("basePath"), '');
						depth = depth.split('/').length - 1;

						// to stop this loop running into the great depths of
						// your filesystem we will restrict it to maxDepth
						if (depth <= prefs.get("maxDepth"))
						{
							findGitProjects(dir);
						}
					}
				}
			}
		});
	}

	/**
	 * Simple OS Sniffing
	 *
	 * Stolen from the brackets.io homepage and re-purposed :)
	 *
	 * @return {string} A 3 letter abrivation of OS we running on.
	 */
	function whatOs()
	{
		var OS = null;

		if (/Windows|Win32|WOW64|Win64/.test(navigator.userAgent))
		{
			OS = 'WIN';
		}
		else if (/Mac/.test(navigator.userAgent))
		{
			OS = 'OSX';
		}
		else if (/Linux|X11/.test(navigator.userAgent))
		{
			OS = 'LIN';
		}

		return OS;
	}

	// Work our magic
	AppInit.appReady(function()
	{
		viewState.set('projects', []);

		findGitProjects
		(
			FileSystem.getDirectoryForPath
			(
				prefs.get("basePath")
			)
		);
	});
});
