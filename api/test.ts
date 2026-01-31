import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Simple test endpoint to verify environment variables are set
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const email = process.env.ICLOUD_EMAIL;
    const password = process.env.ICLOUD_PASSWORD;

    res.status(200).json({
        hasEmail: !!email,
        hasPassword: !!password,
        emailPreview: email ? email.substring(0, 3) + '***' : 'NOT SET',
        timestamp: new Date().toISOString()
    });
}
