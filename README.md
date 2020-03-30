# Star Trek Timelines Spreadsheet Tool
A tool to help with management of various parts of the Star Trek Timelines mobile game

See also [https://www.disruptorbeam.com/games/star-trek-timelines], [https://stt.wiki/wiki/], [https://www.reddit.com/r/StarTrekTimelines/]

This started as a spreadsheet helper tool and grew into a standalone native application with a web deployment option.

## Project Status
In January 2019, the original developer and maintainer of this project known as **IAmPicard** ceased involvement in the tool and removed their resources from public access online. Unfortunate activity directed towards him led to this, including this statement on the site ([https://iampicard.com/]) before it was taken down:

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

This git repository contains the last state of that tool as well as some further modifications. The modifications started as minor
improvements as well as changes to allow it to continue to function, and have grown to be more substantial and include new features such as aids with weekly events. I have no intention of publishing a web version since I don't have the resources
or desire to get into the same situation as the original author.

I encourage you to only use a version of the tool from a trusted source (such as the **Releases** page on GitHub). If a "well intentioned" person online offers to send you a modified version with "extra features" ask for the source code and manually compare against what's here in the repo to ensure no malicious functionality was added.


## Notes

> :exclamation: **HELP WANTED** :exclamation: Are you a developer? Do you love Star Trek Timelines and wish this tool could be improved? I need your help, I can't keep up with maintaining and adding new features to the tool by myself! Please get in touch with me, or fork the repo and start playing with the code. Look in the issue list for inspiration on a needed fix / feature. :thumbsup:

**NOTE** This tool does not automate any part of the game play with the purpose of cheating or creating an unfair advantage; its main purpose is to function as a management tool to help players organize their crew and to add utility where the game is lacking (such as inventory management).

**DISCLAIMER** This tool is provided "as is", without warranty of any kind. Use at your own risk!
It should be understood that *Star Trek Timelines* content and materials are trademarks and copyrights of [Disruptor Beam, Inc.](https://www.disruptorbeam.com/tos/) or its licensors. All rights reserved. This tool is neither endorsed by nor affiliated with Disruptor Beam, Inc. ( [more](/docs/DBSupport.png) )

## Install and run the tool

I recommend you install the development environment and play with the source code yourself; make improvements and submit PRs to help your fellow players. See [contribution guidelines](/docs/CONTRIBUTING.md).

However, if you're only interested in installing and running the tool, head on to the [releases](https://github.com/paulbilnoski/StarTrekTimelinesSpreadsheet/releases) page and pick a recent release to install.

## Features

### Summary Page

![Screenshot tool](/docs/homepage.png "Homepage screenshot")

The first tab shows summary information, including your player name, DBID, and messages of the day from DB or your fleet.

Notable features:
* Voyage status - run time, next dilemma time, worst-case estimate of failure
* Gauntlet status - next crew refresh time, gauntlet end time
* Shuttle status - shuttle return time, unused shuttle count
* Cadet ticket usage
* Inventory max check
* Replicator daily use check
* Event status - event pending or started

### Crew management

![Screenshot tool](/docs/mac-crew.png "Tool screenshot")

On the crew management main page you can sort by various fields, (un)group by rarity as well as export the data in Excel, CSV, JSON or HTML formats.

Notable features:
* Show detail columns for "Base", "Gauntlet" (proficiency), or "Voyage" (base + proficiency average)
* Show "big book" tier
* Show "value" - occurrences of this crew in the top ten of various categories among your other crew
* Show gauntlet score (proficiency sum), gauntlet global rank, voyage score, voyage global rank
* Link to click to open in [datacore.app]
* Hover to see equipment and other details; click equipment icon in hover to replicate

### Voyage

![Screenshot Voyage](/docs/mac-voyage-calculation.png "Voyage screenshot")

![Screenshot Voyage](/docs/mac-voyage-log.png "Voyage log screenshot")

You can calculate best crew for a voyage, as well as monitor the current voyage.

Notable features:
* Calculate best crew for the next voyage, automatically excluding event bonus crew or manually selecting crew
* Monitor current voyage log and estimate time remaining for current voyage
* Perform voyage dilemmas or recall the voyage
* Calculate and export best crew for all voyage pairs
* Export voyage log and statistics

### Gauntlet

![Screenshot Gauntlet Round](/docs/mac-gauntlet.png "Gauntlet Round screenshot")

In this tab you can get run the gauntlet battles without excessive UI frills and with computed odds to beat listed opponents. There are also recommendations for which crew to use in your next gauntlet (if you didn't already start it). Note that the algorithm could use some additional input from contributors.

![Screenshot Gauntlet](/docs/Screenshot-Gauntlet.png "Gauntlet screenshot")

Notable features:
* Compute recommended gauntlet crew
* Display all gauntlet crew selections and current status (battles fought, disabled) and allow revive/restore
* Display last gauntlet match details (win/loss, crits, chance to win, last win reward)
* Display all available gauntlet matchups with chance to win

### Event details

This tab lists details according to the current event, or shows a message if no event is active or pending.

Notable features:
* Displays event details per event type
* Shuttle events show crew base skills including bonus values
* Galaxy events show bonus crew, active missions, items used in all missions, current inventory amounts for the items, where to farm the items
* Skirmish events show crew ship skills for event bonus crew
* Expedition events show bonus crew

### Item management

![Screenshot Items](/docs/mac-items.png "Items screenshot")

This tab lists out all the items you currently have, along with their quantity and type.

Notable features
* Source column displays count of missions that provide the item and hover shows all mission details
* Cadet and faction details show whether the item is available via cadet mission or faction shuttle

### Item Replication

Select an item from the item management view (or other places) to replicate an item without having to dig around in a crew's unequipped item construction tree. Easily select unneeded ship schematics, experience trainers, replicator rations, or sort through items by name and quantity.

### Ship management

![Screenshot Ships](/docs/mac-ships.png "Ships screenshot")

This tab lists out all the ships you currently have, along with their stats.

Notable features
* Sorting by "Level" also sorts by available schematics to allow more easily locating unneeded schematics

### Cryo Collections

See what active, frozen, and unowned crew exist for each collection, and see your progress with collection milestones.

### Top Crew

See your top 10 crew in various categories, for only active crew or including frozen crew. Categories include your base values for the six skills, your proficiency values for the 16 gauntlet pairs, and your crew's global gauntlet ranks for the 16 gauntlet pairs

### Crew Ship Abilities

See a table of your crew's ship abilities, including activation type (Attack, Accuracy, or Evasion) and amount, activation action and amount, times for initialization, duration, and cooldown, charge details, and passive bonuses.

### Factions

See all faction stores, including potential shuttle rewards per faction and the ability to purchase store items. See also how many of each item for sale is in your inventory.

### Missions

![Screenshot Missions](/docs/mac-missions.png "Missions screenshot")

This tab give an overview of all accepted missions and cadet challenged, along with individual requirements and player stats for each quest and challenge, as well as crew success rates for each challenge (node).

### Fleet

![Screenshot Fleet](/docs/Screenshot-Fleet.png "Fleet screenshot")

Basic information about your fleet such as a member list with their last online and event ranks and starbase rooms' status.

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
- https://datacore.app/ : This URL is used to access the "big book" content such as subjective crew rankings

The tool never stores your username or password and it only sends it to DisruptorBeam's official servers for login purposes. If you check the "Stay logged in" checkbox in the login dialog, the tool will store an access_token on your local device in the IndexedDB database.
