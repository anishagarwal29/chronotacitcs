import type { VercelRequest, VercelResponse } from '@vercel/node';
import ICAL from 'ical.js';

/**
 * Raw debug endpoint to see exactly what CalDAV returns
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

        // Get user principal
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

        // Get calendar home
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

        // List calendars
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

        const calendarMatches = calendarListXml.matchAll(/<response[^>]*>([\s\S]*?)<\/response>/gi);
        const calendarUrls: string[] = [];

        for (const match of calendarMatches) {
            const responseBlock = match[1];
            if (responseBlock.includes('<calendar') || responseBlock.includes('<C:calendar')) {
                const hrefMatch = responseBlock.match(/<href[^>]*>([^<]+)<\/href>/i);
                if (hrefMatch) {
                    let url = hrefMatch[1];
                    if (!url.startsWith('http')) {
                        url = 'https://caldav.icloud.com' + url;
                    }
                    calendarUrls.push(url);
                }
            }
        }

        // Fetch from FIRST calendar only and show raw XML
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        const endDate = new Date(now);
        endDate.setDate(now.getDate() + 30);

        const reportBody = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z" 
                      end="${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

        const response = await fetch(calendarUrls[0], {
            method: 'REPORT',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/xml; charset=utf-8',
                'Depth': '1'
            },
            body: reportBody
        });

        const xmlText = await response.text();

        res.status(200).json({
            calendarUrl: calendarUrls[0],
            reportStatus: response.status,
            timeRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString()
            },
            rawXmlPreview: xmlText.substring(0, 2000),
            xmlLength: xmlText.length
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message, stack: error.stack });
    }
}
