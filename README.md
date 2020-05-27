# Star Trek Timelines Spreadsheet Tool
A companion tool to the Star Trek Timelines mobile game to help with management, add conveniences, and provide analysis of your crew, inventory, and activities.

See also
* [https://www.tiltingpoint.com/games/star-trek-timelines/]
* [https://stt.wiki/wiki/]
* [https://www.reddit.com/r/StarTrekTimelines/]

This started as a spreadsheet helper tool and grew into a standalone native application with a web deployment option.

## Project Status
This project is a fork of the original, which is no longer available.

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

This git repository contains the last state of that tool as well as many further modifications. The modifications started as minor
improvements as well as changes to allow it to continue to function, and have grown to be more substantial and include new features such as aids with weekly events. I have no intention of publishing a web version since I don't have the resources
or desire to get into the same situation as the original author.

I encourage you to only use a version of the tool from a trusted source (such as the **Releases** page on GitHub). If a "well intentioned" person online offers to send you a modified version with "extra features" ask for the source code and manually compare against what's here in the repo to ensure no malicious functionality was added.


## Notes

> :exclamation: **HELP WANTED** :exclamation: If you enjoy Star Trek Timelines and wish this tool could be improved, I could use your help. Send pull requests, open tickets, or offer other support as you are able.

**NOTE** This tool does not automate any part of the game play with the purpose of cheating or creating an unfair advantage; its purpose is to function as a tool for management, convenience, and analysis to help players organize their crew and to add utility where the game is lacking (such as inventory management).

**DISCLAIMER** This tool is provided "as is", without warranty of any kind. Use at your own risk!
It should be understood that *Star Trek Timelines* content and materials are trademarks and copyrights of [Tilting Point, Inc.](https://www.tiltingpoint.com/) or its licensors. All rights reserved. This tool is neither endorsed by nor affiliated with Tilting Point, Inc. (or the previous developer, Disruptor Beam, Inc. [more](/docs/DBSupport.png) )

## Install and run the tool

I recommend you install the development environment and play with the source code yourself; make improvements and submit PRs to help your fellow players. See [contribution guidelines](/docs/CONTRIBUTING.md).

However, if you're only interested in installing and running the tool, head on to the [releases](https://github.com/paulbilnoski/StarTrekTimelinesSpreadsheet/releases) page and pick a recent release to install.

## Features

### Summary Page

Shows summary information, including your player name, DBID, and messages of the day from the devs or your fleet.

Notable features:
* Voyage status - run time, next dilemma time, worst-case estimate of failure
* Gauntlet status - next crew refresh time, gauntlet end time
* Shuttle status - shuttle return time, unused shuttle count
* Daily mission completion status (individual and fleet)
* Inventory max check and Replicator daily use check
* Event status - event pending or started

![Screenshot tool](/docs/homepage.png "Homepage screenshot")

### Crew

Sort by various fields, group by rarity as well as export the data as Excel or CSV.

Notable features:
* Show detail column sets for "Base", "Gauntlet" (proficiency), or "Voyage" (base + proficiency average)
* Show "big book" tier and whether the crew is available in the portal
* Show "value" - occurrences of this crew in the top ten of various categories among your other crew
* Show gauntlet score (proficiency sum), gauntlet global rank, voyage score, voyage global rank
* Powerful filtering
  * Semicolon for "or", space for "and", allows queries like "dax pilot;mayw;kirk" to find all Dax that are also Pilots and all Mayweathers and Kirks
* Link to click to open in [datacore.app]
* Hover to see equipment and other details; click equipment icon in hover to replicate
* Show count of frozen crew if multiple

![Screenshot tool](/docs/page_crew_base.png "Crew Base Stats")
![Screenshot tool](/docs/page_crew_gaunt.png "Crew Gauntlet Stats")
![Screenshot tool](/docs/page_crew_voy.png "Crew Voyage Stats")

### Voyage

Calculate "best" crew for a voyage, as well as monitor the current voyage.

Notable features:
* Calculate "best" crew for the next voyage
  * Send crew on a voyage from the tool (game client must be restarted to see changes)
  * Automatically exclude event bonus crew
  * Manually exclude or select crew
  * Uses a native C++ implementation with WASM for improved performance
* Monitor current voyage log
  * Estimated time remaining for current voyage
  * Recalled voyage run time not including recall time
  * Time of next dilemma and duration until next dilemma
  * Estimated time of return if recalled now or recalled when antimatter runs low
  * Listing of voyage rewards, including whether crew is not owned, frozen, or adds a fusion level
* Perform voyage dilemmas or recall the voyage
* Calculate and export best crew for all voyage pairs
* Export voyage log and statistics

![Screenshot Voyage](/docs/page_voy_select.png "Voyage screenshot")

![Screenshot Voyage](/docs/page_voy_log.png "Voyage log screenshot")

### Gauntlet

Run gauntlet battles with a helpful UI

Notable features:
* Avoids excessive UI frills for quicker battles
* Display all available gauntlet matchups with chance to beat listed opponent
  * Display fleetmates distinctly from other opponents
* Display all gauntlet crew selections and current status (battles fought, disabled) and allow revive/restore
* Display last gauntlet match details (win/loss, crits, chance to win, last win reward)
* Recommendation mode to help select crew to use in your next gauntlet (if you didn't already start it).
  * This algorithm could use some additional input from contributors.

![Screenshot Gauntlet Round](/docs/mac-gauntlet.png "Gauntlet Round screenshot")

![Screenshot Gauntlet](/docs/Screenshot-Gauntlet.png "Gauntlet screenshot")

### Events

Details of the current event, or shows a message if no event is active or pending.

Notable features:
* Displays event details for all event types
  * Victory points required for tiers in the top 100 players
  * Your current VP and rank, and top threshold reward VP if not yet reached
  * VP, rank, and VP difference for players above and below 10, 25, and 50 rank spots indicates effort required to move up or be moved down
* Faction (Shuttle) events
  * All crew base skills including bonus values, with frozen status and traits
  * VP gained by next shuttle success
* Supply (Galaxy) events
  * Estimated number of craft turnings to complete to gain top reward threshold
  * VP to be gained by turning in super rare event items gained by craft crits
  * Show all bonus crew, including unowned crew
  * Show crew with bonus values, whether they are on a shuttle or voyage, and other details
  * Show all items to be crafted and which are a part of the 3 active missions
    * Top three best crew to craft the item with a crit, chance to crit, and whether they are frozen
  * Items used in all crafting missions and lowest cost (average items dropped per chron spent) in missions where they are farmed
  * Current inventory amounts of items used to craft event items
  * Missions where crafting material items can be farmed
* Skirmish events show crew ship skills for event bonus crew
* Expedition events show bonus crew

Shuttle Events:
![Screenshot Shuttle Event](/docs/page_event_sh.png "Shuttle Event screenshot")

Galaxy events:
![Screenshot Galaxy Event](/docs/page_event_gal.png "Galaxy Event screenshot")
Galaxy event full bonus crew listing:
![Screenshot Galaxy Event Bonus Crew](/docs/page_event_gal_bonus.png "Galaxy Event Bonus Crew screenshot")
Galaxy event owned crew list:
![Screenshot Galaxy Event Owned Crew](/docs/page_event_gal_crew.png "Galaxy Event Owned Crew screenshot")
Galaxy event crafting details:
![Screenshot Galaxy Event Crafting Details](/docs/page_event_gal_detail.png "Galaxy Event Crafting screenshot")
Galaxy event farming list:
![Screenshot Galaxy Event Farm List](/docs/page_event_gal_farm.png "Galaxy Event Farm List screenshot")

### Items

Lists all items in your inventory, along with their quantity and type.

Notable features
* Displays item icon, name, rarity, quantity, category, and other details
* Powerful filtering
  * Semicolon for "or", space for "and", allows queries like "clo pat;alc;augment transmission" to find all Clothing Patterns, Alcohol, and items returned from the Augment faction
* *Source* column displays count of missions that provide the item - hover to show all mission details
* Cadet and faction details show whether the item is available via cadet mission or faction shuttle mission
* Click an item icon to replicate
* Filter to items provided by ship battles (in "Settings") to help with skirmish farming

![Screenshot Items](/docs/page_item_sources.png "Items screenshot")

### Item Replication

Select an item to replicate to see the replicator dialog.

Notable features
* Easy to find an item to replicate
  * Replicate an item in your inventory
    * Restrictions exist for certain items that cannot be replicated
  * Opened from
    * Item List (click the icon)
    * Crew page (click the item icon in a crew hover)
  * In the game, it is difficult to replicate because you must dig around in a crew's unequipped item construction tree.
* Easily select items from computed categories
  * Ship schematics for ships at max level
  * Experience trainers
  * Replicator rations
* Easily sort and page through items by name and quantity instead of relying on the icon
  * In the game, it is difficult to see the item label in some cases
  * Usually junk items are few in quantity, such as Dabo rewards

![Screenshot Items](/docs/page_item_repl.png "Items screenshot")

### Shuttles

Calculate "best" crew for a open shuttles, as well as monitor the current shuttle status.

Notable features
* See all active shuttles and current status (opened, in progress, completed)
* Select crew for all shuttles and see chance of success
* Compute a "best" assignment of available crew to shuttles
  * Easy helper for Faction events to evenly distribute crew among open shuttle missions
  * Pre-select certain crew and let it compute the remaining slots
* Send shuttles from the tool (game client must be restarted to see changes)

![Screenshot Shuttles](/docs/page_shuttles.png "Shuttles screenshot")

### Ships

Lists the ships you currently have, along with their stats.

Notable features
* Sorting by "Level" also sorts by available schematics to allow more easily locating unneeded schematics

![Screenshot Ships](/docs/mac-ships.png "Ships screenshot")

### Cryo Collections

See what active, frozen, and unowned crew exist for each collection, and see your progress with collection milestones.

![Screenshot Collections](/docs/page_collections.png "Cryo Collections screenshot")

### Top Crew

See your top 10 crew in various categories

Notable features
* Base values category for six skills
* Proficiency values category for the 16 gauntlet pairs
* Gauntlet global rank for the 16 gauntlet pairs
* Shows *EQ* if missing equipment and *L* if not max level
* Toggle inclusion of frozen crew (in "Settings")

![Screenshot Top Base](/docs/page_best_base.png "Top Base screenshot")
![Screenshot Top Base](/docs/page_best_brank.png "Top Base screenshot")

### Crew Ship Abilities

See a table of your crew's ship abilities, including activation type (Attack, Accuracy, or Evasion) and amount, activation action and amount, times for initialization, duration, and cooldown, charge details, and passive bonuses.

![Screenshot Crew Ship Abilities](/docs/page_crewship.png "Crew Ship Ability screenshot")

### Factions

See all faction stores

Notable features
* Purchase faction store items from the tool
* See how many of each item for sale is in your inventory
* See how many shuttle transmissions you have per faction
* See potential shuttle rewards per faction

![Screenshot Faction Stores](/docs/page_facstore.png "Faction Store screenshot")

### Missions

This tab gives an overview of all accepted missions and cadet challenges, along with individual requirements and player stats for each quest and challenge, as well as crew success rates for each challenge (node).

![Screenshot Missions](/docs/mac-missions.png "Missions screenshot")

### Fleet

Notable features
* Fleet message of the day
* Fleet member list with name, level, squad, last online status, event rank
* Fleet chat logs

![Screenshot Fleet](/docs/Screenshot-Fleet.png "Fleet screenshot")

## Development environment

### To get started:
Clone the repo and build with `node.js` v 10.

Minimal set of steps required
* `git clone https://github.com/paulbilnoski/StarTrekTimelinesSpreadsheet.git`
* `cd StarTrekTimelinesSpreadsheet`
* `npm install`
  * You may also need to `npm install electron` if you see the message `Error: Electron failed to install correctly, please delete node_modules/electron and try installing again`
  * You may need to `npm install -g --production windows-build-tools` to get `node-gyp` to install properly (with Python and Visual Studio tools for Electron)
* `npm run dev`

##### Development
* Run `npm run dev` to start *webpack-dev-server*. Electron will launch automatically after compilation.

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
* Set `ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true` and run `electron-builder` to build the native package
* Run `npm run package` to have webpack compile your application into `dist/bundle.js` and `dist/index.html`, and then an `electron-packager` run will be triggered for the current platform/arch, outputting to `builds/`

###### Manual
_Recommendation: Update the "postpackage" script call in `package.json` to specify parameters as you choose and use the `npm run package` command instead of running these steps manually_
* Run `npm run build` to have webpack compile and output your bundle to `dist/bundle.js`
* Then you can call `electron-packager` directly with any commands you choose

If you want to test the production build (In case you think Babili might be breaking something) after running `npm run build` you can then call `npm run prod`. This will cause electron to load off of the `dist/` build instead of looking for the *webpack-dev-server* instance. Electron will launch automatically after compilation.

## Privacy and security
There is no server associated with this tool, all state stays on your device. Here's a comprehensive list of URLs that the tool accesses (all these URLs are accessed over a secure (HTTPS) connection):
- https://thorium.disruptorbeam.com/ : this is the login URL for the game; your username / password or Facebook access token is sent to this URL in order to get an access_token. This URL is only accessed during login.
- https://stt.disruptorbeam.com/ : this is the main Star Trek Timelines API endpoint URL, owned by ~~DisruptorBeam~~ TiltingPoint.
- https://ptpb.pw : this URL is accessed when (and only if) you use the Share dialog to share your crew stats online.
- https://www.facebook.com/v2.8/dialog/oauth : this URL is only accessed if you use the Facebook login option. It's used to obtain a facebook access token which is later sent to DB's server to get an access_token.
- https://datacore.app/ : This URL is used to access the "big book" content such as subjective crew rankings and portal availability of crew

The tool never stores your username or password and it only sends it to the game's official servers for login purposes. If you check the "Stay logged in" checkbox in the login dialog, the tool will store an access_token on your local device in the IndexedDB database.
