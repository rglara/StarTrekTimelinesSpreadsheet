# Star Trek Timelines Spreadsheet Tool
A tool to help with crew management in Star Trek Timelines

## Project Status
As of January 2019, the original developer and maintainer of this project known as **IAmPicard** has ceased involvement in the tool and removed their resources from public access online. Unfortunate activity directed towards him led to this, including this statement on the site ([https://iampicard.com/]) before it was taken down:

> <h1>Goodbye</h1>
> <p>
> 	This website was the home of an open source user tool for the strategy role playing video game
> 	<a href="https://en.wikipedia.org/wiki/Star_Trek_Timelines">Star Trek Timelines</a>, and operated between August 2018 and January
> 	2019. It is now discontinued; this note will stay up until the domain expires in 2020.
> </p>
> <br />
> <h3>What Happened?</h3>
> <p>
> 	I have decided that it’s not worth the hassle for me to continue working on this tool. In the past few days (January 2019) I’ve been
> 	insulted, accused of hacking, doxed and personally threatened.
> </p>
> <p>
> 	I was hoping that developing the tool transparently as free and open-source software would create a community of like-minded
> 	individuals, working to uphold the principles of fairness that I built it on. Instead, with very few exceptions, I got a cold harsh
> 	lesson in what the world really is like – from mooches demanding support without the modicum of self-documentation all the way to
> 	people full of malintent that blatantly abused my work to cheat or gain unfair advantages in the game.
> </p>
> <p>
> 	I want to have nothing to do with that behavior, so I’m retiring. I apologize to the community and to Disruptor Beam if my work made
> 	these flaws more easily discovered and abusable by these petaQ. If someone from DB
> 	contacts me, I’ll happily share all the information I’ve gathered (I won’t do it publicly
> 	for risk of further proliferation).
> </p>
> <p>
> 	During its last month of existence, the website had more than 27,000 unique visitors, with an average of 1,089 unique users logging
> 	in per day. To all the legitimate users of my tool I apologize for taking this resource away from you, I hope you understand my
> 	reasoning and I hope that DB decides to improve / build some of the management functionality the tool provided directly into the
> 	game.
> </p>
> <p>
> 	I also <b>strongly</b> urge you to not install future “versions” of the tool that may be floating around; I will be no longer
> 	working on this project and would have deleted my GitHub page; any future releases will not be done by me, are not endorsed by me,
> 	and will most certainly include malicious functionality that may compromise your credentials or infringe the game’s Terms of
> 	Service.
> </p>
> <p>Thank you for your support!</p>
> <p>-- IAmPicard 🖖</p>

This git repository contains the last state of that tool as well as some further modifications. The modifications are generally very minor improvements
and, where I am able, some changes to allow it to continue to function. I have no intention of publishing a web version since I don't have the resources
or desire to get into the same situation as the original author.

I encourage you to only use a version of the tool from a trusted source (such as the **Releases** page on GitHub). If a "well intentioned" person online offers to send you a modified version with "extra features" ask for the source code and manually compare against what's here in the repo to ensure no malicious functionality was added.


## Notes

> :exclamation: **HELP WANTED** :exclamation: Are you a developer? Do you love Star Trek Timelines and wish this tool could be improved? I need your help, I can't keep up with maintaining and adding new features to the tool by myself! Please get in touch with me, or fork the repo and start playing with the code. Look in the issue list for inspiration on a needed fix / feature. :thumbsup:

**NOTE** This tool does not (and will never) automate any part of the game play; its sole purpose is to help players organize their crew using the functionality built within or with a spreadsheet application of their choice.

**DISCLAIMER** This tool is provided "as is", without warranty of any kind. Use at your own risk!
It should be understood that *Star Trek Timelines* content and materials are trademarks and copyrights of [Disruptor Beam, Inc.](https://www.disruptorbeam.com/tos/) or its licensors. All rights reserved. This tool is neither endorsed by nor affiliated with Disruptor Beam, Inc. ( [more](/docs/DBSupport.png) )

[More tools and information here](https://iampicard.com/)

## Install and run the tool

I recommend you install the development environment and play with the source code yourself; make improvements and submit PRs to help your fellow players. See [contribution guidelines](/docs/CONTRIBUTING.md).

However, if you're only interested in installing and running the tool, head on to the [releases](https://github.com/IAmPicard/StarTrekTimelinesSpreadsheet/releases) page and pick a recent release to install.

## Features

### Crew management

![Screenshot tool](/docs/mac-crew.png "Tool screenshot")

The first tab lets you manage your crew. You can sort by various fields, (un)group by rarity as well as export the data in Excel, CSV, JSON or HTML formats.

### Item management

![Screenshot Items](/docs/mac-items.png "Items screenshot")

This tab lists out all the items you currently have, along with their quantity and type.

### Ship management

![Screenshot Ships](/docs/mac-ships.png "Ships screenshot")

This tab lists out all the ships you currently have, along with their stats.

### Missions

![Screenshot Missions](/docs/mac-missions.png "Missions screenshot")

This tab give an overview of all accepted missions and cadet challenged, along with individual requirements and player stats for each quest and challenge, as well as crew success rates for each challenge (node).

### Crew recommendations

![Screenshot CrewRecommendations](/docs/Screenshot-CrewRecommendations.png "CrewRecommendations screenshot")

*DEPRECATED*

This tab will make recommendations about which crew you can freeze or airlock, and which you need to keep in your active roster, primarily for cadet challenges.

### Gauntlet

![Screenshot Gauntlet](/docs/Screenshot-Gauntlet.png "Gauntlet screenshot")

In this tab you can get recommendations for which crew to use in your next gauntlet (if you didn't already start it), and odds for crew matches (if you already started a gauntlet). Please see source code for details, the algorithm is still "hand-wavy" at this point and could use input from someone more experienced with statistical analysis.

![Screenshot Gauntlet Round](/docs/mac-gauntlet.png "Gauntlet Round screenshot")

### Fleet

![Screenshot Fleet](/docs/Screenshot-Fleet.png "Fleet screenshot")

Basic information about your fleet such as a member list with their last online and event ranks and starbase rooms' status.

### Share your crew stats

![Screenshot Sharing](/docs/Screenshot-ShareOnline.png "Sharing screenshot")

You can export a formatted html page with your crew stats and (optionally) your mission completion stats either to the local PC or directly upload it online, ready to send a link wherever you want - maybe your fleet-mates or to the forum / reddit / discord to ask for advice or just brag :wink: .

### Voyage

![Screenshot Voyage](/docs/mac-voyage-calculation.png "Voyage screenshot")

![Screenshot Voyage](/docs/mac-voyage-log.png "Voyage log screenshot")

You can calculate best crew for a voyage, as well as monitor the current voyage's log.

You can inspect the active state of crew by clicking on the little "baloon" icon. This can tell you whether the crew is currently on a shuttle adventure or on a voyage as well as details about remaining time, loot, etc.

## Development environment

### To get started:
Clone the repo and build with `node.js` v 10.

Minimal set of steps required
* `git clone https://github.com/IAmPicard/StarTrekTimelinesSpreadsheet.git`
* `cd StarTrekTimelinesSpreadsheet`
* `npm install`
  * You may also need to `npm install electron` if you see the message `Error: Electron failed to install correctly, please delete node_modules/electron and try installing again`
* `npm run dev`

##### Development
* Run `npm run dev` to start webpack-dev-server. Electron will launch automatically after compilation.

If changes are made to the C++ native codebase under `/native`:
* On UNIX systems, you can compile to see warnings/errors with the following (though it does not build for proper integration with the app)
  * `$ rm -rf native/build/Release`
  * `$ cd native/build`
  * `$ make`
To rebuild for use with the app run `npm run rebuild` or the `electron-rebuild` executable under `node_modules/.bin/`

If you delete `node_modules/stt*` to get back to a cleaner state, `npm install` again to rebuild the C++ modules. If the install fails, revert any local changes to `package-lock.json`.

##### Production
_You have two options, an automatic build or two manual steps_

###### One Shot
* Set ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true and run "electron-builder" to build the native package
* Run `npm run package` to have webpack compile your application into `dist/bundle.js` and `dist/index.html`, and then an electron-packager run will be triggered for the current platform/arch, outputting to `builds/`

###### Manual
_Recommendation: Update the "postpackage" script call in package.json to specify parameters as you choose and use the `npm run package` command instead of running these steps manually_
* Run `npm run build` to have webpack compile and output your bundle to `dist/bundle.js`
* Then you can call electron-packager directly with any commands you choose

If you want to test the production build (In case you think Babili might be breaking something) after running `npm run build` you can then call `npm run prod`. This will cause electron to load off of the `dist/` build instead of looking for the webpack-dev-server instance. Electron will launch automatically after compilation.

## Privacy and security
There is no server associated with this tool, all state stays on your device. Here's a comprehensive list of URLs that the tool accesses (all these URLs are accessed over a secure (HTTPS) connection):
- https://thorium.disruptorbeam.com/ : this is the login URL for DisruptorBeam; your username / password or Facebook access token is sent to this URL in order to get an access_token. This URL is only accessed during login.
- https://stt.disruptorbeam.com/ : this is the main Star Trek Timelines API endpoint URL, owned by DisruptorBeam.
- https://api.github.com/repos/IAmPicard/StarTrekTimelinesSpreadsheet/releases : this URL contains the list of tool releases. It's accessed during application boot (and from the About tab) to check for new versions. No data is sent along with the request (it's just a GET).
- https://ptpb.pw : this URL is accessed when (and only if) you use the Share dialog to share your crew stats online.
- https://www.facebook.com/v2.8/dialog/oauth : this URL is only accessed if you use the Facebook login option. It's used to obtain a facebook access token which is later sent to DB's server to get an access_token.

The tool never stores your username or password and it only sends it to DisruptorBeam's official servers for login purposes. If you check the "Stay logged in" checkbox in the login dialog, the tool will store an access_token on your local device in the IndexedDB database.
