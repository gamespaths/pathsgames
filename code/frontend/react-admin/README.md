# Paths Games — React Admin


Administration frontend for the Paths Games backend.


## Stack
- **React 18** + **Vite 5**
- **Tailwind CSS 3** (utility classes)
- **Bootstrap 5** (CDN — grid, modals helpers)
- **Font Awesome 6** (CDN — icons)
- **Axios** (API client)
- **React Router 6**

## Design
Follows the medieval dark theme (`v0.16.3-prototype-api`):
- Cinzel / Cinzel Decorative / Crimson Text fonts (Google Fonts)
- Brown/gold/parchment colour palette
- Custom `pg-*` CSS utility classes in `src/index.css`

## Admin sections

| Route              | What it does                                              |
|--------------------|-----------------------------------------------------------|
| `/login`           | Paste your admin JWT access token                        |
| `/`                | Dashboard — server status + guest/story stats            |
| `/guests`          | List, inspect and delete guest users; cleanup expired    |
| `/stories`         | List all stories (any visibility); delete stories        |
| `/stories/import`  | Import a complete story from JSON (`POST /api/admin/stories/import`) |
| `/echo`            | Server health check (`GET /api/echo/status`)             |

## Admin APIs covered

From OpenAPI specs in `code/backend/java/adapter-rest/src/main/resources/openapi/`:

| API                              | Endpoint                        |
|----------------------------------|---------------------------------|
| List all guests                  | `GET /api/admin/guests`         |
| Guest statistics                 | `GET /api/admin/guests/stats`   |
| Get guest by UUID                | `GET /api/admin/guests/:uuid`   |
| Delete guest                     | `DELETE /api/admin/guests/:uuid`|
| Cleanup expired guests           | `DELETE /api/admin/guests/expired` |
| List all stories                 | `GET /api/admin/stories`        |
| Import story                     | `POST /api/admin/stories/import`|
| Delete story                     | `DELETE /api/admin/stories/:uuid`|
| Server status / echo             | `GET /api/echo/status`          |

## Development

```bash
cd code/frontend/react-admin
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api/*` to `http://localhost:8042` (configurable via the in-app server selector).

## Authentication

The admin panel uses a **JWT access token** entered on the login screen.
- Token is stored in `localStorage` under the key `pg_admin_token`.
- All admin API calls include `Authorization: Bearer <token>`.
- To logout, click **Logout** in the navbar (token is cleared from localStorage).

## To run test
```bash
# Run all test
npm test	
# Generate report on coverage folder
npm run test:coverage
```


## Version Control
- First version created with AI prompts:
    > ciao, into "code/frontend/react-admin" folder create a new project with react con vite e bootstrap e Tailwind e font awesome. Project is a administration frontend of project, read all documents into "documentation_v0" to understand my project. I wanna you create admin section to all admin APIs "code/backend/java/adapter-rest/src/main/resources/openapi". Let's go! Never change files outside  "code/frontend/react-admin" . for admin i wanna a login interface where user insert jwt token to be used in all api calls , use graphics from "documentation_v0/website_concepts_v0/v0.16.3-prototype-api"

    > mi fai uno script in .github/workflows per il progetto "react-admin" ? poi aggiorna il "documentation_v0/Step08_ConfigureMinimalCI.md"
- **Document Version**: 0.16.4
    | Version | Description | Date |
    | --- | --- | --- |
    | 0.16.4 | Created react-admin project | April 23, 2026 |
- **Last Updated**: April 23, 2026
- **Status**: In progress




# &lt; Paths Games /&gt;
All source code and informations in this repository are the result of careful and patient development work by developer team, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website



## License
Made with ❤️ by <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>
&bull; 
Public projects 
<a href="https://www.gnu.org/licenses/gpl-3.0"  valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*


The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.


Narrative Content & Assets: The story, dialogues, characters, sounds, musics, paint, all artist contents and world-building (located on /data folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).


(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.



