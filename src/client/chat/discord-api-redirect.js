import * as Cookies from "js-cookie";
import domReady from "../dom-ready";

domReady.then(() => {
	let response = document.getElementById("response").dataset.response;

	try {
		if (response) {
			let user_data = JSON.parse(response);

			let days = (user_data.expires_in / 62400) - 0.1; // seconds to days minus some slack
			Cookies.set("user_data", user_data, { expires: days });

			window.opener.postMessage({
				success: true,
				response: user_data
			}, window.location.origin);

			document.getElementById("await").style.display = "none";
			document.getElementById("success").style.display = "block";
			return;
		}
	}
	catch (err) {
		console.error("JSON parse probably failed", err);
	}

	document.getElementById("await").style.display = "none";
	document.getElementById("failure").style.display = "block";
});