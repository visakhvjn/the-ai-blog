import dotenv from 'dotenv';

dotenv.config();

export const auth0Config = {
	authRequired: false,
	auth0Logout: true,
	secret: process.env.AUTH0_SECRET,
	baseURL: process.env.BASE_URL,
	clientID: process.env.AUTH0_CLIENT_ID,
	issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
};
