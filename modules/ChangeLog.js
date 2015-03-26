define(function (require, exports, module)
{
	"use strict";

	// Import some modules
	var
		Dialogs = brackets.getModule('widgets/Dialogs'),
		FileSystem = brackets.getModule("filesystem/FileSystem"),
		FileUtils = brackets.getModule("file/FileUtils"),
		ExtensionUtils  = brackets.getModule("utils/ExtensionUtils"),
		marked = require("marked")
	;

	// Some private vars
	var PREFIX, PREFS;
	var ROOT_PATH = ExtensionUtils.getModulePath(module) + '../';
	var PATH_TO_CHANGE_LOG = ROOT_PATH + "CHANGELOG.md";
	var PATH_TO_PACKAGE = ROOT_PATH + "package.json";

	/**
	 * Reads the package.json file and grabs the version from it.
	 * Reading is async so we have to start using promises.
	 *
	 * @return jQuery Promise
	 */
	function getInstalledVersion()
	{
		var d = $.Deferred();

		FileUtils.readAsText(FileSystem.getFileForPath(PATH_TO_PACKAGE))
		.done(function(text)
		{
			d.resolve(JSON.parse(text).version);
		});

		return d.promise();
	}

	/**
	 * Simple method to determine if we need to actually show the change log.
	 *
	 * @return jQuery Promise
	 */
	function needToShowChangeLog()
	{
		var d = $.Deferred();

		getInstalledVersion().done(function(version)
		{
			if (PREFS.get('lastVersion') === version)
			{
				d.resolve(false);
			}
			else
			{
				// Update the lastVersion stored in our prefs
				PREFS.set('lastVersion', version); PREFS.save();

				d.resolve(true);
			}
		});

		return d.promise();
	}

	/**
	 * This will actual show the change log modal.
	 * We use a js markdown parser to fill the modal with the CHANGELOG.md
	 * from the root of the package.
	 *
	 * @see https://github.com/chjj/marked
	 */
	function showChangeLog()
	{
		// Show the change log modal
		var dialog = Dialogs.showModalDialogUsingTemplate
		(
			require('text!../modals/change-log.html'),	// grab modal html
			true										// allow auto dismiss
		);

		// Read in the markdown change log
		FileUtils.readAsText(FileSystem.getFileForPath(PATH_TO_CHANGE_LOG))
		.done(function (content)
		{
			// Convert the markdown to html
			content = marked(content, { gfm: true, breaks: true });

			// Add the changelog to the modal
			$('.modal-body', dialog.getElement()).html(content);
		});
	}

	/**
	 * Our Constructor
	 *
	 * @param string PREFIX A special string we use to id ourselves in brackets.
	 * @param object PREFS Contains all our user defined preferences.
	 */
	exports.init = function (prefix, prefs)
	{
		// Set our privates
		PREFIX = prefix; PREFS = prefs;

		// Add a new preference to keep track of the version.
		PREFS.definePreference('lastVersion', 'string', null);

		// Check to see if we have been upgraded or freshly installed
		needToShowChangeLog().done(function(show)
		{
			if (show === true)
			{
				showChangeLog();
			}
		});
	}
});
