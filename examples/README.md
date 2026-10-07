# Examples

Real output of @dakaio/domainscout-mcp, generated on 2026-10-07. Availability and prices change over time.

## In an AI assistant (MCP)

You ask: *"I'm naming a note-taking app. Brainstorm 500 names and tell me which .com domains are free."*

The assistant brainstorms the names and calls the tool once with all 500 of them:

```json
{
  "name": "check_domains",
  "arguments": {
    "domains": [
      "quillwise",
      "quillnest",
      "quillflow",
      "quillhub",
      "… 496 more"
    ],
    "tlds": [
      "com"
    ]
  }
}
```

The tool answers with this text, plus the same data as structured JSON:

```text
Checked 500 domain(s) in 23.0s: 27 available, 473 taken.

AVAILABLE (cheapest known offer for each):
- quillloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=quillloom.com
- scribeloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=scribeloom.com
- scribebloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=scribebloom.com
- foliobloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=foliobloom.com
- glyphbloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=glyphbloom.com
- outlinenest.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinenest.com
- outlineloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlineloom.com
- outlinemint.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinemint.com
- outlinespark.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinespark.com
- outlinestack.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinestack.com
- outlinewave.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinewave.com
- outlinegrove.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinegrove.com
- outlinehaven.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinehaven.com
- pencilloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=pencilloom.com
- pencilmint.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=pencilmint.com
- pencilstack.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=pencilstack.com
- pencilwave.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=pencilwave.com
- pencilhaven.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=pencilhaven.com
- pencilbloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=pencilbloom.com
- notchloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchloom.com
- notchmint.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchmint.com
- notchspark.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchspark.com
- notchvault.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchvault.com
- notchgrove.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchgrove.com
- notchhaven.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchhaven.com
- notchforge.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchforge.com
- notchbloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchbloom.com
Not confirmed by a registrar means: not found in the registry or DNS. Prices are standard list prices; premium or reserved names look the same, so the registrar's page shows the final price.
Each line shows the cheapest known offer. Check a few chosen names again to see every registrar, including links for registrars without public prices.

TAKEN: quillwise.com, quillnest.com, quillflow.com, quillhub.com, quillpad.com, quillbox.com,
  quillbase.com, quillkit.com, quilllab.com, quillcraft.com, quillmint.com, quillspark.com,
  quillstack.com, quillvault.com, quillwave.com, quillgrove.com, quillhaven.com, quillforge.com,
  quillbloom.com, jotwise.com, jotnest.com, jotflow.com, jothub.com, jotloom.com, jotpad.com,
  jotbox.com, jotbase.com, jotkit.com, jotlab.com, jotcraft.com, jotmint.com, jotspark.com,
  jotstack.com, jotvault.com, jotwave.com, jotgrove.com, jothaven.com, jotforge.com, jotbloom.com,
  notewise.com, notenest.com, noteflow.com, notehub.com, noteloom.com, notepad.com, notebox.com,
  notebase.com, notekit.com, notelab.com, notecraft.com, notemint.com, notespark.com, notestack.com,
  notevault.com, notewave.com, notegrove.com, notehaven.com, noteforge.com, notebloom.com,
  inkwise.com, inknest.com, inkflow.com, inkhub.com, inkloom.com, inkpad.com, inkbox.com,
  inkbase.com, inkkit.com, inklab.com, inkcraft.com, inkmint.com, inkspark.com, inkstack.com,
  inkvault.com, inkwave.com, inkgrove.com, inkhaven.com, inkforge.com, inkbloom.com, pagewise.com,
  pagenest.com, pageflow.com, pagehub.com, pageloom.com, pagepad.com, pagebox.com, pagebase.com,
  pagekit.com, pagelab.com, pagecraft.com, pagemint.com, pagespark.com, pagestack.com,
  pagevault.com, pagewave.com, pagegrove.com, pagehaven.com, pageforge.com, pagebloom.com,
  memowise.com, memonest.com, memoflow.com, memohub.com, memoloom.com, memopad.com, memobox.com,
  memobase.com, memokit.com, memolab.com, memocraft.com, memomint.com, memospark.com, memostack.com,
  memovault.com, memowave.com, memogrove.com, memohaven.com, memoforge.com, memobloom.com,
  scribewise.com, scribenest.com, scribeflow.com, scribehub.com, scribepad.com, scribebox.com,
  scribebase.com, scribekit.com, scribelab.com, scribecraft.com, scribemint.com, scribespark.com,
  scribestack.com, scribevault.com, scribewave.com, scribegrove.com, scribehaven.com,
  scribeforge.com, draftwise.com, draftnest.com, draftflow.com, drafthub.com, draftloom.com,
  draftpad.com, draftbox.com, draftbase.com, draftkit.com, draftlab.com, draftcraft.com,
  draftmint.com, draftspark.com, draftstack.com, draftvault.com, draftwave.com, draftgrove.com,
  drafthaven.com, draftforge.com, draftbloom.com, ideawise.com, ideanest.com, ideaflow.com,
  ideahub.com, idealoom.com, ideapad.com, ideabox.com, ideabase.com, ideakit.com, idealab.com,
  ideacraft.com, ideamint.com, ideaspark.com, ideastack.com, ideavault.com, ideawave.com,
  ideagrove.com, ideahaven.com, ideaforge.com, ideabloom.com, mindwise.com, mindnest.com,
  mindflow.com, mindhub.com, mindloom.com, mindpad.com, mindbox.com, mindbase.com, mindkit.com,
  mindlab.com, mindcraft.com, mindmint.com, mindspark.com, mindstack.com, mindvault.com,
  mindwave.com, mindgrove.com, mindhaven.com, mindforge.com, mindbloom.com, brainwise.com,
  brainnest.com, brainflow.com, brainhub.com, brainloom.com, brainpad.com, brainbox.com,
  brainbase.com, brainkit.com, brainlab.com, braincraft.com, brainmint.com, brainspark.com,
  brainstack.com, brainvault.com, brainwave.com, braingrove.com, brainhaven.com, brainforge.com,
  brainbloom.com, thinkwise.com, thinknest.com, thinkflow.com, thinkhub.com, thinkloom.com,
  thinkpad.com, thinkbox.com, thinkbase.com, thinkkit.com, thinklab.com, thinkcraft.com,
  thinkmint.com, thinkspark.com, thinkstack.com, thinkvault.com, thinkwave.com, thinkgrove.com,
  thinkhaven.com, thinkforge.com, thinkbloom.com, clipwise.com, clipnest.com, clipflow.com,
  cliphub.com, cliploom.com (in deletion, may become available soon), clippad.com, clipbox.com,
  clipbase.com, clipkit.com, cliplab.com, clipcraft.com, clipmint.com, clipspark.com, clipstack.com,
  clipvault.com, clipwave.com, clipgrove.com, cliphaven.com, clipforge.com, clipbloom.com,
  snapwise.com, snapnest.com, snapflow.com, snaphub.com, snaploom.com, snappad.com, snapbox.com,
  snapbase.com, snapkit.com, snaplab.com, snapcraft.com, snapmint.com, snapspark.com, snapstack.com,
  snapvault.com, snapwave.com, snapgrove.com, snaphaven.com, snapforge.com, snapbloom.com,
  storywise.com, storynest.com, storyflow.com, storyhub.com, storyloom.com, storypad.com,
  storybox.com, storybase.com, storykit.com, storylab.com, storycraft.com, storymint.com,
  storyspark.com, storystack.com, storyvault.com, storywave.com, storygrove.com, storyhaven.com,
  storyforge.com, storybloom.com, leafwise.com, leafnest.com, leafflow.com, leafhub.com,
  leafloom.com, leafpad.com, leafbox.com, leafbase.com, leafkit.com, leaflab.com, leafcraft.com,
  leafmint.com, leafspark.com, leafstack.com, leafvault.com, leafwave.com, leafgrove.com,
  leafhaven.com, leafforge.com, leafbloom.com, foliowise.com, folionest.com, folioflow.com,
  foliohub.com, folioloom.com, foliopad.com, foliobox.com, foliobase.com, foliokit.com,
  foliolab.com, foliocraft.com, foliomint.com, foliospark.com, foliostack.com, foliovault.com,
  foliowave.com, foliogrove.com, foliohaven.com, folioforge.com, glyphwise.com,
  glyphnest.com (in deletion, may become available soon), glyphflow.com, glyphhub.com,
  glyphloom.com, glyphpad.com, glyphbox.com, glyphbase.com, glyphkit.com, glyphlab.com,
  glyphcraft.com, glyphmint.com, glyphspark.com, glyphstack.com, glyphvault.com, glyphwave.com,
  glyphgrove.com, glyphhaven.com, glyphforge.com, marginwise.com, marginnest.com, marginflow.com,
  marginhub.com, marginloom.com, marginpad.com, marginbox.com, marginbase.com, marginkit.com,
  marginlab.com, margincraft.com, marginmint.com, marginspark.com, marginstack.com, marginvault.com,
  marginwave.com, margingrove.com, marginhaven.com, marginforge.com, marginbloom.com,
  outlinewise.com, outlineflow.com, outlinehub.com, outlinepad.com, outlinebox.com, outlinebase.com,
  outlinekit.com, outlinelab.com, outlinecraft.com, outlinevault.com, outlineforge.com,
  outlinebloom.com, pencilwise.com, pencilnest.com, pencilflow.com, pencilhub.com, pencilpad.com,
  pencilbox.com, pencilbase.com, pencilkit.com, pencillab.com, pencilcraft.com, pencilspark.com,
  pencilvault.com, pencilgrove.com, pencilforge.com, paperwise.com, papernest.com, paperflow.com,
  paperhub.com, paperloom.com, paperpad.com, paperbox.com, paperbase.com, paperkit.com,
  paperlab.com, papercraft.com, papermint.com, paperspark.com, paperstack.com, papervault.com,
  paperwave.com, papergrove.com, paperhaven.com, paperforge.com, paperbloom.com, notchwise.com,
  notchnest.com, notchflow.com, notchhub.com, notchpad.com, notchbox.com, notchbase.com,
  notchkit.com, notchlab.com, notchcraft.com, notchstack.com, notchwave.com, versewise.com,
  versenest.com, verseflow.com, versehub.com, verseloom.com, versepad.com, versebox.com,
  versebase.com, versekit.com, verselab.com, versecraft.com, versemint.com, versespark.com,
  versestack.com, versevault.com, versewave.com, versegrove.com, versehaven.com, verseforge.com,
  versebloom.com, threadwise.com, threadnest.com, threadflow.com, threadhub.com, threadloom.com,
  threadpad.com, threadbox.com, threadbase.com, threadkit.com, threadlab.com, threadcraft.com,
  threadmint.com, threadspark.com, threadstack.com, threadvault.com, threadwave.com,
  threadgrove.com, threadhaven.com, threadforge.com, threadbloom.com
```

## Command line

### Check 500 brainstormed names at once

The everyday case: almost every good .com is taken, so an assistant brainstorms hundreds of names and checks them all in one call.

```bash
npx @dakaio/domainscout-mcp check quillwise quillnest quillflow quillhub "… 496 more" --tlds com
```

```text
Checked 500 domain(s) in 23.0s: 27 available, 473 taken.

AVAILABLE (cheapest known offer for each):
- quillloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=quillloom.com
- scribeloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=scribeloom.com
- scribebloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=scribebloom.com
- foliobloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=foliobloom.com
- glyphbloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=glyphbloom.com
- outlinenest.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinenest.com
- outlineloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlineloom.com
- outlinemint.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinemint.com
- outlinespark.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinespark.com
- outlinestack.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinestack.com
- outlinewave.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinewave.com
- outlinegrove.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinegrove.com
- outlinehaven.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=outlinehaven.com
- pencilloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=pencilloom.com
- pencilmint.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=pencilmint.com
- pencilstack.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=pencilstack.com
- pencilwave.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=pencilwave.com
- pencilhaven.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=pencilhaven.com
- pencilbloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=pencilbloom.com
- notchloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchloom.com
- notchmint.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchmint.com
- notchspark.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchspark.com
- notchvault.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchvault.com
- notchgrove.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchgrove.com
- notchhaven.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchhaven.com
- notchforge.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchforge.com
- notchbloom.com: $10.46/yr at Cloudflare https://www.cloudflare.com/domains/search/?q=notchbloom.com
Not confirmed by a registrar means: not found in the registry or DNS. Prices are standard list prices; premium or reserved names look the same, so the registrar's page shows the final price.
Each line shows the cheapest known offer. Check a few chosen names again to see every registrar, including links for registrars without public prices.

TAKEN: quillwise.com, quillnest.com, quillflow.com, quillhub.com, quillpad.com, quillbox.com,
  quillbase.com, quillkit.com, quilllab.com, quillcraft.com, quillmint.com, quillspark.com,
  quillstack.com, quillvault.com, quillwave.com, quillgrove.com, quillhaven.com, quillforge.com,
  quillbloom.com, jotwise.com, jotnest.com, jotflow.com, jothub.com, jotloom.com, jotpad.com,
  jotbox.com, jotbase.com, jotkit.com, jotlab.com, jotcraft.com, jotmint.com, jotspark.com,
  jotstack.com, jotvault.com, jotwave.com, jotgrove.com, jothaven.com, jotforge.com, jotbloom.com,
  notewise.com, notenest.com, noteflow.com, notehub.com, noteloom.com, notepad.com, notebox.com,
  notebase.com, notekit.com, notelab.com, notecraft.com, notemint.com, notespark.com, notestack.com,
  notevault.com, notewave.com, notegrove.com, notehaven.com, noteforge.com, notebloom.com,
  inkwise.com, inknest.com, inkflow.com, inkhub.com, inkloom.com, inkpad.com, inkbox.com,
  inkbase.com, inkkit.com, inklab.com, inkcraft.com, inkmint.com, inkspark.com, inkstack.com,
  inkvault.com, inkwave.com, inkgrove.com, inkhaven.com, inkforge.com, inkbloom.com, pagewise.com,
  pagenest.com, pageflow.com, pagehub.com, pageloom.com, pagepad.com, pagebox.com, pagebase.com,
  pagekit.com, pagelab.com, pagecraft.com, pagemint.com, pagespark.com, pagestack.com,
  pagevault.com, pagewave.com, pagegrove.com, pagehaven.com, pageforge.com, pagebloom.com,
  memowise.com, memonest.com, memoflow.com, memohub.com, memoloom.com, memopad.com, memobox.com,
  memobase.com, memokit.com, memolab.com, memocraft.com, memomint.com, memospark.com, memostack.com,
  memovault.com, memowave.com, memogrove.com, memohaven.com, memoforge.com, memobloom.com,
  scribewise.com, scribenest.com, scribeflow.com, scribehub.com, scribepad.com, scribebox.com,
  scribebase.com, scribekit.com, scribelab.com, scribecraft.com, scribemint.com, scribespark.com,
  scribestack.com, scribevault.com, scribewave.com, scribegrove.com, scribehaven.com,
  scribeforge.com, draftwise.com, draftnest.com, draftflow.com, drafthub.com, draftloom.com,
  draftpad.com, draftbox.com, draftbase.com, draftkit.com, draftlab.com, draftcraft.com,
  draftmint.com, draftspark.com, draftstack.com, draftvault.com, draftwave.com, draftgrove.com,
  drafthaven.com, draftforge.com, draftbloom.com, ideawise.com, ideanest.com, ideaflow.com,
  ideahub.com, idealoom.com, ideapad.com, ideabox.com, ideabase.com, ideakit.com, idealab.com,
  ideacraft.com, ideamint.com, ideaspark.com, ideastack.com, ideavault.com, ideawave.com,
  ideagrove.com, ideahaven.com, ideaforge.com, ideabloom.com, mindwise.com, mindnest.com,
  mindflow.com, mindhub.com, mindloom.com, mindpad.com, mindbox.com, mindbase.com, mindkit.com,
  mindlab.com, mindcraft.com, mindmint.com, mindspark.com, mindstack.com, mindvault.com,
  mindwave.com, mindgrove.com, mindhaven.com, mindforge.com, mindbloom.com, brainwise.com,
  brainnest.com, brainflow.com, brainhub.com, brainloom.com, brainpad.com, brainbox.com,
  brainbase.com, brainkit.com, brainlab.com, braincraft.com, brainmint.com, brainspark.com,
  brainstack.com, brainvault.com, brainwave.com, braingrove.com, brainhaven.com, brainforge.com,
  brainbloom.com, thinkwise.com, thinknest.com, thinkflow.com, thinkhub.com, thinkloom.com,
  thinkpad.com, thinkbox.com, thinkbase.com, thinkkit.com, thinklab.com, thinkcraft.com,
  thinkmint.com, thinkspark.com, thinkstack.com, thinkvault.com, thinkwave.com, thinkgrove.com,
  thinkhaven.com, thinkforge.com, thinkbloom.com, clipwise.com, clipnest.com, clipflow.com,
  cliphub.com, cliploom.com (in deletion, may become available soon), clippad.com, clipbox.com,
  clipbase.com, clipkit.com, cliplab.com, clipcraft.com, clipmint.com, clipspark.com, clipstack.com,
  clipvault.com, clipwave.com, clipgrove.com, cliphaven.com, clipforge.com, clipbloom.com,
  snapwise.com, snapnest.com, snapflow.com, snaphub.com, snaploom.com, snappad.com, snapbox.com,
  snapbase.com, snapkit.com, snaplab.com, snapcraft.com, snapmint.com, snapspark.com, snapstack.com,
  snapvault.com, snapwave.com, snapgrove.com, snaphaven.com, snapforge.com, snapbloom.com,
  storywise.com, storynest.com, storyflow.com, storyhub.com, storyloom.com, storypad.com,
  storybox.com, storybase.com, storykit.com, storylab.com, storycraft.com, storymint.com,
  storyspark.com, storystack.com, storyvault.com, storywave.com, storygrove.com, storyhaven.com,
  storyforge.com, storybloom.com, leafwise.com, leafnest.com, leafflow.com, leafhub.com,
  leafloom.com, leafpad.com, leafbox.com, leafbase.com, leafkit.com, leaflab.com, leafcraft.com,
  leafmint.com, leafspark.com, leafstack.com, leafvault.com, leafwave.com, leafgrove.com,
  leafhaven.com, leafforge.com, leafbloom.com, foliowise.com, folionest.com, folioflow.com,
  foliohub.com, folioloom.com, foliopad.com, foliobox.com, foliobase.com, foliokit.com,
  foliolab.com, foliocraft.com, foliomint.com, foliospark.com, foliostack.com, foliovault.com,
  foliowave.com, foliogrove.com, foliohaven.com, folioforge.com, glyphwise.com,
  glyphnest.com (in deletion, may become available soon), glyphflow.com, glyphhub.com,
  glyphloom.com, glyphpad.com, glyphbox.com, glyphbase.com, glyphkit.com, glyphlab.com,
  glyphcraft.com, glyphmint.com, glyphspark.com, glyphstack.com, glyphvault.com, glyphwave.com,
  glyphgrove.com, glyphhaven.com, glyphforge.com, marginwise.com, marginnest.com, marginflow.com,
  marginhub.com, marginloom.com, marginpad.com, marginbox.com, marginbase.com, marginkit.com,
  marginlab.com, margincraft.com, marginmint.com, marginspark.com, marginstack.com, marginvault.com,
  marginwave.com, margingrove.com, marginhaven.com, marginforge.com, marginbloom.com,
  outlinewise.com, outlineflow.com, outlinehub.com, outlinepad.com, outlinebox.com, outlinebase.com,
  outlinekit.com, outlinelab.com, outlinecraft.com, outlinevault.com, outlineforge.com,
  outlinebloom.com, pencilwise.com, pencilnest.com, pencilflow.com, pencilhub.com, pencilpad.com,
  pencilbox.com, pencilbase.com, pencilkit.com, pencillab.com, pencilcraft.com, pencilspark.com,
  pencilvault.com, pencilgrove.com, pencilforge.com, paperwise.com, papernest.com, paperflow.com,
  paperhub.com, paperloom.com, paperpad.com, paperbox.com, paperbase.com, paperkit.com,
  paperlab.com, papercraft.com, papermint.com, paperspark.com, paperstack.com, papervault.com,
  paperwave.com, papergrove.com, paperhaven.com, paperforge.com, paperbloom.com, notchwise.com,
  notchnest.com, notchflow.com, notchhub.com, notchpad.com, notchbox.com, notchbase.com,
  notchkit.com, notchlab.com, notchcraft.com, notchstack.com, notchwave.com, versewise.com,
  versenest.com, verseflow.com, versehub.com, verseloom.com, versepad.com, versebox.com,
  versebase.com, versekit.com, verselab.com, versecraft.com, versemint.com, versespark.com,
  versestack.com, versevault.com, versewave.com, versegrove.com, versehaven.com, verseforge.com,
  versebloom.com, threadwise.com, threadnest.com, threadflow.com, threadhub.com, threadloom.com,
  threadpad.com, threadbox.com, threadbase.com, threadkit.com, threadlab.com, threadcraft.com,
  threadmint.com, threadspark.com, threadstack.com, threadvault.com, threadwave.com,
  threadgrove.com, threadhaven.com, threadforge.com, threadbloom.com
```

### A few names, every registrar

Names without a TLD are tried in .com, .net and .ai. With only a few free domains, each gets links to every registrar.

```bash
npx @dakaio/domainscout-mcp check quillfern lumaforge getquillfern
```

```text
Checked 9 domain(s) in 1.6s: 5 available, 4 taken.

AVAILABLE (where to buy, cheapest first):
- quillfern.net
  Cloudflare: $11.86/yr, renews at $11.86/yr: https://www.cloudflare.com/domains/search/?q=quillfern.net
  Porkbun: $12.52/yr, renews at $12.52/yr: https://porkbun.com/checkout/search?q=quillfern.net
  Namecheap: https://www.namecheap.com/domains/registration/results/?domain=quillfern.net
  Spaceship: https://www.spaceship.com/domain-search/?query=quillfern.net
  GoDaddy: https://www.godaddy.com/domainsearch/find?domainToCheck=quillfern.net
  Name.com: https://www.name.com/domain/search/quillfern.net
  Dynadot: https://www.dynadot.com/domain/search?domain=quillfern.net
  NameSilo: https://www.namesilo.com/domain/search-domains?query=quillfern.net
  Hover: https://www.hover.com/domains/results?q=quillfern.net
- quillfern.ai
  Sold for at least 2 years at a time.
  Cloudflare: $80.00/yr, renews at $80.00/yr: https://www.cloudflare.com/domains/search/?q=quillfern.ai
  Porkbun: $82.70/yr, renews at $82.70/yr: https://porkbun.com/checkout/search?q=quillfern.ai
  Namecheap: https://www.namecheap.com/domains/registration/results/?domain=quillfern.ai
  Spaceship: https://www.spaceship.com/domain-search/?query=quillfern.ai
  GoDaddy: https://www.godaddy.com/domainsearch/find?domainToCheck=quillfern.ai
  Name.com: https://www.name.com/domain/search/quillfern.ai
  Dynadot: https://www.dynadot.com/domain/search?domain=quillfern.ai
  NameSilo: https://www.namesilo.com/domain/search-domains?query=quillfern.ai
  Hover: https://www.hover.com/domains/results?q=quillfern.ai
- getquillfern.com
  Cloudflare: $10.46/yr, renews at $10.46/yr: https://www.cloudflare.com/domains/search/?q=getquillfern.com
  Porkbun: $11.08/yr, renews at $11.08/yr: https://porkbun.com/checkout/search?q=getquillfern.com
  Namecheap: https://www.namecheap.com/domains/registration/results/?domain=getquillfern.com
  Spaceship: https://www.spaceship.com/domain-search/?query=getquillfern.com
  GoDaddy: https://www.godaddy.com/domainsearch/find?domainToCheck=getquillfern.com
  Name.com: https://www.name.com/domain/search/getquillfern.com
  Dynadot: https://www.dynadot.com/domain/search?domain=getquillfern.com
  NameSilo: https://www.namesilo.com/domain/search-domains?query=getquillfern.com
  Hover: https://www.hover.com/domains/results?q=getquillfern.com
- getquillfern.net
  Cloudflare: $11.86/yr, renews at $11.86/yr: https://www.cloudflare.com/domains/search/?q=getquillfern.net
  Porkbun: $12.52/yr, renews at $12.52/yr: https://porkbun.com/checkout/search?q=getquillfern.net
  Namecheap: https://www.namecheap.com/domains/registration/results/?domain=getquillfern.net
  Spaceship: https://www.spaceship.com/domain-search/?query=getquillfern.net
  GoDaddy: https://www.godaddy.com/domainsearch/find?domainToCheck=getquillfern.net
  Name.com: https://www.name.com/domain/search/getquillfern.net
  Dynadot: https://www.dynadot.com/domain/search?domain=getquillfern.net
  NameSilo: https://www.namesilo.com/domain/search-domains?query=getquillfern.net
  Hover: https://www.hover.com/domains/results?q=getquillfern.net
- getquillfern.ai
  Sold for at least 2 years at a time.
  Cloudflare: $80.00/yr, renews at $80.00/yr: https://www.cloudflare.com/domains/search/?q=getquillfern.ai
  Porkbun: $82.70/yr, renews at $82.70/yr: https://porkbun.com/checkout/search?q=getquillfern.ai
  Namecheap: https://www.namecheap.com/domains/registration/results/?domain=getquillfern.ai
  Spaceship: https://www.spaceship.com/domain-search/?query=getquillfern.ai
  GoDaddy: https://www.godaddy.com/domainsearch/find?domainToCheck=getquillfern.ai
  Name.com: https://www.name.com/domain/search/getquillfern.ai
  Dynadot: https://www.dynadot.com/domain/search?domain=getquillfern.ai
  NameSilo: https://www.namesilo.com/domain/search-domains?query=getquillfern.ai
  Hover: https://www.hover.com/domains/results?q=getquillfern.ai
Not confirmed by a registrar means: not found in the registry or DNS. Prices are standard list prices; premium or reserved names look the same, so the registrar's page shows the final price.

TAKEN: quillfern.com, lumaforge.com, lumaforge.net (until 2027-08-13), lumaforge.ai
```

### Exact domains, URLs and other TLDs

A name with a TLD is checked exactly as given; URLs are reduced to their domain.

```bash
npx @dakaio/domainscout-mcp check getacme.io https://www.example.org/about acme --tlds dev,app
```

```text
Checked 4 domain(s) in 1.5s: 1 available, 3 taken.

AVAILABLE (where to buy, cheapest first):
- getacme.io
  Porkbun: $28.12/yr, renews at $51.80/yr: https://porkbun.com/checkout/search?q=getacme.io
  Cloudflare: $32.00/yr, renews at $50.00/yr: https://www.cloudflare.com/domains/search/?q=getacme.io
  Namecheap: https://www.namecheap.com/domains/registration/results/?domain=getacme.io
  Spaceship: https://www.spaceship.com/domain-search/?query=getacme.io
  GoDaddy: https://www.godaddy.com/domainsearch/find?domainToCheck=getacme.io
  Name.com: https://www.name.com/domain/search/getacme.io
  Dynadot: https://www.dynadot.com/domain/search?domain=getacme.io
  NameSilo: https://www.namesilo.com/domain/search-domains?query=getacme.io
  Hover: https://www.hover.com/domains/results?q=getacme.io
Not confirmed by a registrar means: not found in the registry or DNS. Prices are standard list prices; premium or reserved names look the same, so the registrar's page shows the final price.

TAKEN: example.org, acme.dev, acme.app
```

### Structured output

The same data the MCP tool returns as structured content.

```bash
npx @dakaio/domainscout-mcp check getquillfern.com --json
```

```json
{
  "summary": {
    "available": 0,
    "likely_available": 1,
    "taken": 0,
    "reserved": 0,
    "unknown": 0,
    "total": 1,
    "elapsed_ms": 1034
  },
  "results": [
    {
      "domain": "getquillfern.com",
      "display": "getquillfern.com",
      "input": "getquillfern.com",
      "tld": "com",
      "status": "likely_available",
      "note": "Not in the registry. Premium or reserved names can look the same; the registrar shows the final price.",
      "evidence": [
        {
          "source": "dns",
          "result": "nxdomain",
          "ms": 39
        },
        {
          "source": "rdap",
          "result": "not_found",
          "server": "rdap.verisign.com",
          "ms": 645
        }
      ],
      "buy": [
        {
          "registrar": "Cloudflare",
          "url": "https://www.cloudflare.com/domains/search/?q=getquillfern.com",
          "affiliate": false,
          "price": {
            "registration": 10.46,
            "renewal": 10.46,
            "currency": "USD",
            "minYears": 1,
            "source": "cfdomainpricing.com (community mirror of Cloudflare's prices)",
            "updated": "2026-10-06"
          }
        },
        {
          "registrar": "Porkbun",
          "url": "https://porkbun.com/checkout/search?q=getquillfern.com",
          "affiliate": false,
          "price": {
            "registration": 11.08,
            "renewal": 11.08,
            "currency": "USD",
            "minYears": 1,
            "source": "Porkbun price API"
          }
        },
        {
          "registrar": "Namecheap",
          "url": "https://www.namecheap.com/domains/registration/results/?domain=getquillfern.com",
          "affiliate": false
        },
        {
          "registrar": "Spaceship",
          "url": "https://www.spaceship.com/domain-search/?query=getquillfern.com",
          "affiliate": false
        },
        {
          "registrar": "GoDaddy",
          "url": "https://www.godaddy.com/domainsearch/find?domainToCheck=getquillfern.com",
          "affiliate": false
        },
        {
          "registrar": "Name.com",
          "url": "https://www.name.com/domain/search/getquillfern.com",
          "affiliate": false
        },
        {
          "registrar": "Dynadot",
          "url": "https://www.dynadot.com/domain/search?domain=getquillfern.com",
          "affiliate": false
        },
        {
          "registrar": "NameSilo",
          "url": "https://www.namesilo.com/domain/search-domains?query=getquillfern.com",
          "affiliate": false
        },
        {
          "registrar": "Hover",
          "url": "https://www.hover.com/domains/results?q=getquillfern.com",
          "affiliate": false
        }
      ]
    }
  ],
  "invalid": [],
  "tlds": [
    "com",
    "net",
    "ai"
  ],
  "warnings": [],
  "elapsedMs": 1034
}
```
