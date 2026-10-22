# Later pass: do not treat this as the v1 site

v1 recreates the current Squarespace site: same URLs, same roster, same prices, same class copy, Mindbody schedule widget `ce1600307310`. This note is the improvement list for a follow-up PR. Do not merge v1 to production and do not change DNS. A Netlify site connected to this repo is what produces preview links and stores the Netlify Forms.

## Page map to add

The live navigation is only Schedule, Classes, Rates, Our Team, About, and Attend a Class. These pages are not on the current site and should be a later information architecture, not this preview:

- New here / first class
- Dedicated class pages for HotFlo, PowerFlo, IgnyteSculpt, BlissFlo, and Stretch (HotHIIT, PowerHIIT45, and IgnyteSculpt45 can stay linked from Classes)
- Contact and location, with a map and hours
- Privacy policy and terms of use
- Events (the homepage gallery still carries old pop-up captions: Goddess Flow, Booty Burn, spring equinox)
- A real blog, once the studio has stories to publish

## Confirm before publishing as fact

- ZIP. The live site and OpenStreetMap print 75033 for 12021 Dallas Parkway. Some business listings print 75034. v1 keeps 75033 because that is what the current site says.
- Hours. Public listings disagree with each other, and the current site does not publish hours. v1 does not invent a schedule of open hours.
- Intro offer. An Instagram post has described a complimentary first class. The rates page does not. v1 does not advertise a free class.
- Social handles. The current site links `instagram.com/hotbodyyogastudio` and `facebook.com/HotBodyYogaStudio`. A public Instagram profile `@ignyteyoga` also exists. v1 keeps the links that are on the site.
- Photos. v1 uses the files downloaded from the Squarespace CDN, including Unsplash and iStock images and older Hot Body graphics. Replace stock and legacy art with current studio photography when the owners choose files.

## Copy and claims to review

- Infrared section cites the Journal of the American College of Cardiology and the Mayo Clinic for vessel function, cholesterol, circulation, flexibility, weight loss, recovery, and blood sugar. Those lines are still on v1 because they are on the live page. They are not linked to a paper. Review or remove them.
- HotHIIT still repeats the live page’s calorie, metabolism, and body-composition lines. Same review.
- Blog posts (Feeding your Soul, Summer Retreat 2019, Yoga Reimagined, Exploring Colima) were Squarespace sample text. v1 keeps the title, date, author, and photo and says the body was sample text.
- Christie Cheney’s page had lorem ipsum under “A compelling title,” the inversion sections, and template class names (Etiam Ultricies and similar). v1 keeps her real bio, quote, favorite-pose line, and Younity paragraph.
- Book a Class was lorem ipsum. v1 points it at the Mindbody schedule.
- The newsletter block said it had no storage option. v1 posts to a Netlify Form named `newsletter` (and teacher training posts to `teacher-training`). No Mailchimp or other third party.
- 200-hour teacher training calendar is the published series January 19–April 21, 2024. Ask the owners for the next dates, tuition, and curriculum before advertising a current training.
- Texas Big Star says the offer expired May 31, 2023. v1 says that date has passed and links to rates.
- `/home-original` is the older Hot Body Yoga homepage. `/instructors-1` matches the current roster. `/home` on Squarespace canonicals to `/`.

## SEO to deepen later

v1 has one H1 per page, a unique title and meta description, canonical URLs, `sitemap.xml`, `robots.txt` that allows search and AI crawlers, and ExerciseGym + LocalBusiness JSON-LD on the homepage. A later pass can aim titles at “hot yoga Frisco,” write longer local landing pages, and add hours once they are confirmed.

## Typos fixed in v1

- “A MESsAGE” to “A message”
- “fire up for your mind” to “fire up your mind”
- “disburse” to “disperse,” “objectives” to “objects”
- “Trial and tribulations” to “Trials and tribulations”
- “3 MONTH OF CLASSES” / “6 MONTH OF CLASSES” to “3 months” / “6 months”
- “small ground instruction” to “small group instruction”
- “cardiovascular alone” to “cardiovascular work along”
- “Fire Up Your PRactice” to “Fire up your practice”
- “become aN instructor” to “an instructor”
- “trap to your body” to “trap against your body”
