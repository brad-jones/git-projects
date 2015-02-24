define(function (require, exports, module)
{
	/**
	 * Simple OS Sniffing
	 *
	 * Stolen from the brackets.io homepage and re-purposed :)
	 *
	 * @return {string} A 3 letter abrivation of OS we running on.
	 */
	function get()
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

	/**
	 * Boolean Platform Checker
	 *
	 * @param {string} os A 3 letter abrivation of OS we running on.
	 *                    That would match the get methods return value.
	 *
	 * @returns {Boolean}
	 */
	function is(os)
	{
		if (get() === os)
		{
			return true;
		}
		else
		{
			return false;
		}
	}

	// Export our public API
	exports.get = get;
	exports.is = is;
});
