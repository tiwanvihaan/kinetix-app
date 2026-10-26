const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get("clear_access_token") === 'true';

const clearStoredAccessToken = () => {
	window.localStorage.removeItem('token');
}

const getAppParams = () => {
	if (isClearAccessTokenRequested()) {
		clearStoredAccessToken();
	}
	return {
		appId: 'kinetix-app-id',
		token: '1232sdfdf',
		functionsVersion: 'kinetix-function-version',
		appBaseUrl: 'kinetix-function-version',
	}
}


export const appParams = {
	...getAppParams()
}
