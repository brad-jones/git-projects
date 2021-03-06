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
	"use strict";

	// Import some modules
	var
		AppInit = brackets.getModule('utils/AppInit'),
		FileUtils = brackets.getModule('file/FileUtils'),
		FileSystem = brackets.getModule('filesystem/FileSystem'),
		PreferencesManager = require('modules/PreferencesManager'),
		ProjectManager = brackets.getModule('project/ProjectManager'),
		Dialogs = brackets.getModule('widgets/Dialogs'),
		ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
		CommandManager = brackets.getModule("command/CommandManager"),
		Menus = brackets.getModule("command/Menus"),
		QuickOpen = brackets.getModule("search/QuickOpen"),
		ChangeLog = require('modules/ChangeLog')
	;

	// Define some constants
	var
		HUMAN_NAME = 'Git Projects',
		COMP_NAME = 'git-projects',
		LIST_COMMAND = COMP_NAME + '.list',
		QUICK_OPEN_PREFIX = '*',
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

	// Setup our PreferencesManager
	PreferencesManager.initPrefs(COMP_NAME);
	var prefs = PreferencesManager.getPrefs();
	var viewState = PreferencesManager.getViewState();

	// Load our change log module
	ChangeLog.init(COMP_NAME, prefs);

	// Attach the indexGitProject method to some events.
	AppInit.appReady(indexGitProjects);
	PreferencesManager.onChange(indexGitProjects);

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
	 * Re Indexes the Git Projects
	 *
	 * This method is attached to a number of events.
	 * So that we don't rebuild the index multiple succsive
	 * times we use a simple debounce timer mechanisium.
	 *
	 * @return void
	 */
	var deBounceTimer;
	function indexGitProjects()
	{
		clearTimeout(deBounceTimer);

		deBounceTimer = setTimeout(function()
		{
			if (prefs.get('basePath') !== null)
			{
				viewState.set('projects', []);

				findGitProjects
				(
					FileSystem.getDirectoryForPath
					(
						prefs.get('basePath')
					)
				);
			}
		}, 250);
	}

	/**
	 * Quick Open Plugin
	 *
	 * This is where we expose the functionality of this extension.
	 * We export nothing.
	 */
	QuickOpen.addQuickOpenPlugin
	({
		name: COMP_NAME,
		label: HUMAN_NAME,	// ignored before Sprint 34
		languageIds: [],	// empty array = all file types  (Sprint 23+)
		fileTypes:   [],	// (< Sprint 23)
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
});
