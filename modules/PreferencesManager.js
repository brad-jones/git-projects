define(function (require, exports, module)
{
	// Import some modules
	var
		BracketsPrefs = brackets.getModule('preferences/PreferencesManager'),
		Dialogs = brackets.getModule('widgets/Dialogs'),
		FileUtils = brackets.getModule('file/FileUtils'),
		FileSystem = brackets.getModule('filesystem/FileSystem')
	;

	// Some private vars
	var PREFIX, PREFS, VIEWSTATE;

	/**
	 * Intialise our Preferences, set some Defaults.
	 *
	 * @param {string} prefix The prefix to use for all preference operations.
	 *
	 * @return void
	 */
	function initPrefs(prefix)
	{
		PREFIX = prefix;
		PREFS = BracketsPrefs.getExtensionPrefs(PREFIX);
		VIEWSTATE = BracketsPrefs.stateManager.getPrefixedSystem(PREFIX);

		// All prefs have their defaults set to null here so that we can set our
		// defaults specfically afterwards. This will in effect publish all our
		// settings into the users Preferences File.
		PREFS.definePreference('maxDepth', 'number', null);
		PREFS.definePreference('basePath', 'string', null);

		// We default the max depth to 2 levels, most won't need more than this.
		if (PREFS.get('maxDepth') === null) PREFS.set('maxDepth', 2);

		// Run the first run method if we are null
		if (PREFS.get('basePath') === null) firstRun();
	}

	/**
	 * First Run Modal
	 *
	 * This shows a first run modal asking the user to select a base path.
	 * Without the base path set this plugin is basically useless. We will
	 * continue to popup this modal at startup until a valid path is set.
	 *
	 * @return void
	 */
	function firstRun()
	{
		// Show the first run modal
		var firstRunDialog = Dialogs.showModalDialogUsingTemplate
		(
			require('text!../modals/first-run.html'),	// grab modal html
			false										// do not auto dismiss
		);

		// Set the placeholder based on the OS we are running on
		// This may provide an additonal hint to help windows users.
		switch (brackets.platform)
		{
			case 'win': var placeholder = 'C:\\Base\\Path'; break;
			default: var placeholder = '/base/path';
		}

		$('.'+PREFIX+' input.base-path').prop('placeholder', placeholder);

		// Browse Button Handler
		$('.'+PREFIX+' button.browse').click(function(event)
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
						$('.'+PREFIX+' input.base-path').val(dir[0]);
					}
				}
			);
		});

		// Cancel Button Handler
		$('.'+PREFIX+' button.cancel').click(function(event)
		{
			firstRunDialog.close();

			Dialogs.showModalDialog
			(
				PREFIX+'-error',
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
		$('.'+PREFIX+' button.save').click(function(event)
		{
			var path = $('.'+PREFIX+' input.base-path').val();

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
							PREFIX+'-error',
							'Opps: Path Not Found',
							'The path you specfied does not exist on your system!'
						);
					}
					else
					{
						firstRunDialog.close();

						// ensure trailing slash - this is important
						if (path.substr(-1,1) != '/') path = path + '/';

						PREFS.set("basePath", path);
						PREFS.save();
					}
				});
			}
			catch (Exception)
			{
				Dialogs.showModalDialog
				(
					PREFIX+'-error',
					'Opps: Your Path was Not Valid',
					'Paths must be absolute, relative paths are not allowed!'
				);
			}
		});
	}

	/**
	 * Returns our very own Preferences Namespace
	 *
	 * @return {PreferencesManager} A namespaced version.
	 */
	function getPrefs()
	{
		return PREFS;
	}

	/**
	 * Returns our very own Viewstate Namespace
	 *
	 * @return {stateManager} A namespaced version.
	 */
	function getViewState()
	{
		return VIEWSTATE;
	}

	/**
	 * Runs the callback whenever any of our prefrences change.
	 *
	 * @param {Function} callback
	 *
	 * @return void
	 */
	function onChange(callback)
	{
		PREFS.on('change', 'maxDepth', callback);
		PREFS.on('change', 'basePath', callback);
	}

	// Export our public API
	exports.initPrefs = initPrefs;
	exports.getPrefs = getPrefs;
	exports.getViewState = getViewState;
	exports.onChange = onChange;
});
