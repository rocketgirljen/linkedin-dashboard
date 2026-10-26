# LinkedIn Post Dashboard

A private dashboard that shows which of your LinkedIn posts perform best and why: by post type, persona, hook style, format, funnel stage, and posting day and time. It ends with plain-language takeaways you can use when planning next week's posts.

Everything runs in your web browser. Your files are never uploaded anywhere. There is no login, no server, and no tracking.

## What you need

1. **A LinkedIn analytics export** (an .xlsx spreadsheet). Required.
2. **Your Notion content calendar** (a .csv file). Optional, but it adds the hook text, format, funnel stage, pillars, and posting time.
3. **Your saved tags** (a .json file). Optional. The dashboard creates this for you the first time you tag posts.

## Step 1: Export your analytics from LinkedIn

1. On LinkedIn (desktop browser, not the phone app), open your profile.
2. Click **Analytics** (or **View all analytics** under your profile summary).
3. Click **Post impressions** or any of the analytics cards to open the full analytics page.
4. In the top right, pick a **date range** (for example, the past 90 days or past year).
5. Click **Export**. LinkedIn downloads a file named something like `Content_2026-07-01_2026-09-30_JenniferWright.xlsx`.
6. Keep that file somewhere handy, for example in a folder called `data` next to this project. Files in `data/` and any .xlsx file are never added to the code repository.
7. LinkedIn caps each export at 50 top posts. To cover more, export several date ranges and drop all the files onto the dashboard at once. They are combined and duplicate posts are removed.

The export usually has five sheets: Discovery, Engagement, Top Posts, Followers, and Demographics. The dashboard looks for each one by name and by its column headings. If LinkedIn renames or drops a sheet, you get a message on screen and that section is skipped rather than breaking everything.

Note: LinkedIn's export lists each post's **impressions** and total **engagements** but not reactions, comments, and reposts separately. If your export has those columns, they are used. If not, the dashboard fills comments from the numbers you log in Notion, and the engagement rate falls back to total engagements divided by impressions.

## Step 2: Export your content calendar from Notion

1. In Notion, open **The Creator OS > Schedule > Master Databases > Content Calendar**.
2. Click the **...** menu in the top right of the database and choose **Export**.
3. Set **Export format** to **CSV**, leave **Include subpages** off, and click **Export**.
4. Unzip the download if Notion gives you a .zip. You want the .csv file inside.

Only rows where **Platform** is LinkedIn and **Status** is Published are used. These columns matter:

| Column | How it is used |
| --- | --- |
| Name | Used as the hook text (LinkedIn's export has no post text). |
| Publication Date | Date and time posted. The time powers the time-of-day chart. |
| Live Post Link | Matched to the LinkedIn export first. If blank, the date is used instead. |
| Content Type | Powers the Performance by Format section. |
| Funnel | Powers the Performance by Funnel Stage section. |
| Content Pillars | Notion links are stripped; the names power the Performance by Content Pillar section. |
| Impressions, Reactions, Comments, Reposts, Saves, New Followers | Used only when the LinkedIn export does not have the number. |
| Post Type, Persona | Not in the calendar today. If you add these columns later, they are picked up as starting tags. |

Every other column is ignored.

Every published LinkedIn row in the calendar is shown, even when the LinkedIn export does not include that post. Those posts use the numbers you logged in Notion and carry a "Notion numbers" label. They are also listed at the bottom of the dashboard so you can check the link or date, or load the export that covers them.

Matching works in this order: the same link, the same post ID inside the link, then the Publication Date. When two posts share a date, the Name is compared with the words in each LinkedIn link to pick the right one.

## Step 3: Open the dashboard

### The easy way: the web link

If GitHub Pages is turned on for this repository (see below), open the link, for example `https://rocketgirljen.github.io/linkedin-dashboard/`. The page is public but it holds no data. Your files only go into your own browser tab.

### On your own computer

You need Node.js installed once (download the LTS version from nodejs.org). Then, in a terminal inside this folder:

```
npm install
npm run dev
```

Open the address it prints, usually http://localhost:5173.

### Load your files

1. Drop the LinkedIn .xlsx file onto box 1, or click the box and choose it.
2. Drop the Notion .csv onto box 2.
3. If you saved tags before, drop the .json onto box 3.
4. Not sure what it will look like? Click **Try it with sample data**. The sample is made up.

## Step 4: Tag your posts

Post Type and Persona are not in the LinkedIn export or the calendar, so you pick them from dropdowns in the **Tag Posts and Fix Matches** section at the bottom. Tick **Only untagged** to see what is left.

Post types: Personal Story, Pattern Naming, System Reframe, Myth-Busting, Framework, Launch.
Personas: Overlooked Expert, Scope Sponge, Quiet Fixer.

Click **Download tags (.json)** when you are done. Tags are also remembered by your browser, but the downloaded file is your real backup. Keep it with your exports. Next time, drop it onto box 3 and every post you already tagged is filled in. Tags are keyed by post URL, so they work with any new export that includes the same posts.

## Reading the dashboard

Sections appear in this order:

1. **This Week's Takeaways.** Three to five sentences generated from the data. A group is only named once it has at least 3 posts. Otherwise you see "not enough data yet".
2. **Overview.** Pick 30 days, 90 days, or All. Ranges count back from the newest date in your export, not from today. Totals and a trend line of impressions and engagement rate.
3. **Post Type Performance.** Average engagement rate, comments, and impressions per post type with post counts.
4. **Persona Performance.** The same by persona. When a calendar is loaded, extra breakdowns by Format, Funnel Stage, and Content Pillar follow.
5. **Hook Analysis.** Hook length against engagement with a marker at 53 characters, plus performance by opener pattern (question, number, "I" statement, contrarian, other). Hooks over 53 characters are listed.
6. **Timing.** Performance by day of week and time of day. Time of day comes from the Notion calendar, because LinkedIn's export only has the date.
7. **Top and Bottom 10 Posts.** Sortable table with a link to each post.
8. **Audience Fit.** Share of viewers at Senior level and above, top job functions and industries, and follower growth.
9. **Tag Posts and Fix Matches.** The tagging table and the list of unmatched calendar rows.

How the numbers are calculated:

- Engagement rate = (reactions + comments + reposts) / impressions.
- Comments per 1,000 impressions = comments / impressions x 1,000. Shown on its own because comments matter most for reach.
- Group averages are the plain average of each post's rate, so one huge post does not swamp the group.

## Updating the dashboard

- **New data:** export again from LinkedIn and Notion and drop the new files in. Then drop in your saved tags .json and tag any new posts.
- **Brand colors:** open `src/styles.css`. The colors are listed at the very top as variables. Change the values and save.
- **Hook limit, post types, personas:** open `src/lib/constants.js`.
- **Code changes:** after editing, run `npm test` to check the math, then `npm run build` to produce the `dist/` folder. If GitHub Pages is set up, pushing to `main` publishes the new version automatically.

## Turning on GitHub Pages (optional)

1. On GitHub, open the repository and go to **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Merge this code into the `main` branch. The workflow in `.github/workflows/pages.yml` builds the site and publishes it.
4. The link appears on the Pages settings page, usually `https://<your-username>.github.io/linkedin-dashboard/`.

The published page contains only the dashboard code and the made-up sample files. Your own data stays in your browser.

## For developers

- `npm run dev` starts the app. `npm run build` makes a static site in `dist/`. `npm test` runs the tests. `npm run check:emdash` fails if an em dash appears anywhere. `npm run sample` regenerates the synthetic sample files.
- Stack: Vite, React, SheetJS (`xlsx`), PapaParse, Chart.js.
- `src/lib/` holds the logic: `xlsxParser.js` (export), `calendar.js` (Notion CSV), `matching.js` (joining the two), `metrics.js` (the math), `takeaways.js` (the sentences), `tags.js` (manual tags).
- `tests/` covers the parser, calendar matching, metric math (including three hand-checked engagement rates), and the "never cite a group under 3 posts" rule.
