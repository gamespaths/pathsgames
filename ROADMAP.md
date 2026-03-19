# Roadmap
This document defines the project plan to build the **Paths Games**, an playable web-based game, with tasks list and future release under consideration and planned. 

## Version 0: Start the project

[Version 0 - Roadmap details](./documentation_v0/Step00_Roadmap.md)
- ✅ [Start the project](./documentation_v0/Step01_StartProject.md)
- ✅ [Create the repository](./documentation_v0/Step02_CreateTheRepository.md)
- ✅ [Define the V1 scope](./documentation_v0/Step03_DefineScope.md)
- ✅ [Technology stack](./documentation_v0/Step04_TechnologyStack.md)
- ✅ [Backend structure](./documentation_v0/Step05_BackendStructure.md)
- ✅ [Naming conventions](./documentation_v0/Step06_NamingConventions.md)
- ✅ [Configure website](./documentation_v0/Step07_ConfigureWebsite.md)
- ✅ [Configure Environments & CI](./documentation_v0/Step08_ConfigureMinimalCI.md)
- ✅ [Design core data model](./documentation_v0/Step09_DesignCoreDataModel.md)
- ✅ [Create initial DB schema](./documentation_v0/Step10_CreateDBschema.md)
- next steps: start develop game engine ...


## Future / Under Consideration
- Version 1: start the crowfouning campaign 
    - Use Creative Commons (CC BY-NC-SA) for contents (images, story, musics, ... )
    - Audit Logs (log_events, log_movements): If the game scales, these tables will become huge. Consider moving old logs to a cold storage database or using an asynchronous logging system.

- Version 1.1: If you find that the frontend is making too many REST calls to compose a single view, you could consider GraphQL for new version.
    
- Version 2: combact system and complete all game engine features

- Version 3: mobile version 
    - Version 3.1: integration with Google play with Android App 
    - Version 3.2: create Steam application
    - Version 3.3: Debian with dedicated package

- Version 4: graphical with advanced game-engine and desktop application integrated with steam




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




