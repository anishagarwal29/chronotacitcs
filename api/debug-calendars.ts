import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Debug endpoint to see what calendars and events are available
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const email = process.env.ICLOUD_EMAIL;
    const password = process.env.ICLOUD_PASSWORD;

    if (!email || !password) {
        return res.status(500).json({ error: 'Missing credentials' });
    }

    try {
        const authHeader = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');

        // Step 1: Get user principal
        const principalUrl = 'https://caldav.icloud.com/';
        const userPrincipalBody = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal />
  </d:prop>
</d:propfind>`;

        const userPrincipalResponse = await fetch(principalUrl, {
            method: 'PROPFIND',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/xml; charset=utf-8',
                'Depth': '0'
            },
            body: userPrincipalBody
        });

        const userPrincipalXml = await userPrincipalResponse.text();
        const principalMatch = userPrincipalXml.match(/<current-user-principal[^>]*>[\s\S]*?<href[^>]*>([^<]+)<\/href>/i);

        let userPrincipalUrl = principalMatch![1];
        if (!userPrincipalUrl.startsWith('http')) {
            userPrincipalUrl = 'https://caldav.icloud.com' + userPrincipalUrl;
        }

        // Step 2: Get calendar home
        const calendarHomeBody = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set />
  </d:prop>
</d:propfind>`;

        const calendarHomeResponse = await fetch(userPrincipalUrl, {
            method: 'PROPFIND',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/xml; charset=utf-8',
                'Depth': '0'
            },
            body: calendarHomeBody
        });

        const calendarHomeXml = await calendarHomeResponse.text();
        const calendarHomeMatch = calendarHomeXml.match(/<calendar-home-set[^>]*>[\s\S]*?<href[^>]*>([^<]+)<\/href>/i);

        let calendarHomeUrl = calendarHomeMatch![1];
        if (!calendarHomeUrl.startsWith('http')) {
            calendarHomeUrl = 'https://caldav.icloud.com' + calendarHomeUrl;
        }

        // Step 3: List ALL calendars
        const calendarListBody = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
  </d:prop>
</d:propfind>`;

        const calendarListResponse = await fetch(calendarHomeUrl, {
            method: 'PROPFIND',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/xml; charset=utf-8',
                'Depth': '1'
            },
            body: calendarListBody
        });

        const calendarListXml = await calendarListResponse.text();

        // Extract all calendar URLs and names
        const calendarMatches = calendarListXml.matchAll(/<response[^>]*>([\s\S]*?)<\/response>/gi);
        const calendars = [];

        for (const match of calendarMatches) {
            const responseBlock = match[1];
            if (responseBlock.includes('<calendar') || responseBlock.includes('<C:calendar')) {
                const hrefMatch = responseBlock.match(/<href[^>]*>([^<]+)<\/href>/i);
                const nameMatch = responseBlock.match(/<displayname[^>]*>([^<]+)<\/displayname>/i);
                if (hrefMatch) {
                    let url = hrefMatch[1];
                    if (!url.startsWith('http')) {
                        url = 'https://caldav.icloud.com' + url;
                    }
                    calendars.push({
                        name: nameMatch ? nameMatch[1] : 'Unknown',
                        url: url
                    });
                }
            }
        }

        res.status(200).json({
            userPrincipalUrl,
            calendarHomeUrl,
            calendars,
            totalCalendars: calendars.length
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
