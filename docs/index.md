---
toc: true 
---

# `TIKOCI` — RouterOS Code & Container Depot

```js
const ipaPronunciations = [
    "tiˈkoʊʃi", // "tee-KOH-shee"
    "tɪˈkɔʃi", // "tih-KAW-shee"
    "tiˈkosi", // "tee-KOH-see"
    "tɪ'koʃi", // "tih-KOH-shee"
    "tiˈkɔʧi", // "tee-KAW-chee"
    "tiˈkoʊʧi", // "tee-KOH-chee"
    "tɪk oʊ si aɪ" // "tik-O-C-I"
  ];
```

Contains various Open Source Mikrotik RouterOS projects, generally focused on `/container` and scripting.  This page serves as an commented index to the more developed projects within TIKOCI.  

> See [Repositories](https://github.com/orgs/tikoci/repositories) for full list of all TIKOCI's code and projects.

### <mark>NEW</mark> Automating CHR install on UTM for macOS

The [tikoci/mikropkl](https://github.com/tikoci/mikropkl) packages RouterOS CHR as macOS UTM virtual machines for automated install.  No more fussing with disks or display.  [Releases](https://github.com/tikoci/mikropkl/releases/latest) has `utm://` links and `.zip` files for recent versions of RouterOS ("CHR") ready-to-use with macOS UTM.   

```js
FileAttachment("images/chr-utm-serialopen.png").image()
```

### RouterOS "TUI Experiments" — __[`$lsbridge`](https://forum.mikrotik.com/viewtopic.php?t=214189#p1123276)__

This is a RouterOS scripts (requires 7.18beta) that "visualizes" the VLAN-aware bridge settings.  Eventually, interactive control will be added.  But even "view-only", handy tool to "see" the bridge settings.  [Script Download](scripts/lsbridge.rsc) _(requires 7.18+)_

```js
FileAttachment("images/lsbridge-hex-s-forum.jpeg").image()
```

_See https://forum.mikrotik.com/viewtopic.php?t=214189#p1123276 for code and more screenshots._  [Script Download](scripts/lsbridge.rsc) _(requires 7.18+)_

### Web Tools

* #### `diff` RouterOS commands changes between two versions
  ##### https://tikoci.github.io/restraml
  > The [tikoci/restraml](https://github.com/tikoci/restraml) project provides a web page that allows picking two RouterOS versions to see what commands have changed in the CLI or RouterOS APIs like REST.  

* #### `curl2rsc` - Convert `curl` to `/tool/fetch` 
  ##### https://tikoci.github.io/postman-code-generators
  > The project is mainly code for Postman's "Code Snippet" to support `/tool/fetch` - but hosts a web page to convert "most" `curl` commands into the right RouterOS command using `/tool/fetch`.  Various "output styles" are supported to provide examples of using `/tool/fetch` in various use cases.

* #### Observable Notebook _Mikrotik Collection_   
  ##### https://observablehq.com/collection/@a2m0/mikrotik
  Currently contains two "tools":

    * **[`utf2rsc`](https://observablehq.com/@a2m0/utf2rsc?collection=@a2m0/mikrotik)** - fun converter for emojis and UTF-8 into RouterOS `string` using byte-escaping (`\xx`)

    * **[`csv2rsc`](https://observablehq.com/@a2m0/csv2rsc?collection=@a2m0/mikrotik)** - CSV conversion into RouterOS `array` types, also an example of using a notebook to do pre-parsing of data and generate scripts

* #### RouterOS REST API Schemas (`RAML`,`OpenAPI`,...)
  ##### https://tikoci.github.io/restraml#Schema+Downloads
  > The "Scheme Downloads" is the main output of `tikoci/restraml` project.  The RouterOS REST API schemas are arranged by version and can be used in most Web API tools.  For use with **[Postman App](https://postman.com)**, see the following post on Mikrotik's Forum: [REST API schema for Postman & more](https://forum.mikrotik.com/viewtopic.php?t=199476).


### Current Container Projects 

The collection includes more RouterOS containers, but the most developed are:

* **[`make.d` container](https://github.com/tikoci/make.d)**, which wraps Alpine packages using `make` into a multiprocess service loader.  Basically a "better base" for RouterOS – including bash complemtions, development tool, and many TUI tools.  The `mk` provides access to add tools, as well as manage "services".  While, experimental, `make.d` container has been stable for months in lab to run MQTT broker.

* **[tikoci/cligames](https://github.com/tikoci/cligames)** old BSD game collections (30+ games!) – wrapped into RouterOS container – with retro `telnet` interface.  Available on [DockerHub](https://hub.docker.com/r/ammo74/cligames)

* **[tikoci/netinstall](https://github.com/tikoci/netinstall)**  runs Mikrotik's netinstall tool as a RouterOS container, and QEMU to enable it for ARM/ARM64.   This netinstall container uses UNIX `make` to download packages needed _automatically_ via provided `/container/env`.  Available on [DockerHub](https://hub.docker.com/r/ammo74/netinstall)

* **[tikoci/serial2http](https://github.com/tikoci/serial2http)** wraps RouterOS "remote" serial port as an HTTP interface. Available on [DockerHub](https://hub.docker.com/r/ammo74/serial2http)

> There are additional containers stored in TIKOCI's [Repositories](https://github.com/orgs/tikoci/repositories).  Please note some repos are used as part of other builds, and other are just experiments - use unlisted containers with care, or as examples.  If you have questions or problems, feel free to file an issue within the particular repo.  

### "Inside RouterOS" Projects 

Not all project in tikoci are containers. Projects below generally re-package, inspect, generate, or extract Mikrotik things, using GitHub Action builder.

* **[tikoci/fat-chr](https://github.com/tikoci/fat-chr)** rebuilds RouterOS CHR `.raw` package, into a valid UEFI image for UTM/Apple/other virtualization platforms.  Largely by using `fat`, instead of `ext2` for the EFI partition.  UEFI-enabled CHR images are in the [project releases](https://github.com/tikoci/fat-chr/releases)

* **[tikoci/restraml](https://github.com/tikoci/restraml)** is not a container, but builds API schemas for any RouterOS version, using [CHR in GitHub Action](https://github.com/tikoci/restraml/actions/workflows/manual-using-extra-docker-in-docker.yaml) to dynamically create API schemas from RouterOS's `/console/inspect` command.  The generated schemes can be used in Postman and other API tools to enable [RouterOS's REST API](https://help.mikrotik.com/docs/display/ROS/REST+API) software development.  
  > This project also "hosts" the [RouterOS Command `diff` Tool](https://tikoci.github.io/restraml) via GitHub Pages, and is implemented as a "serverless, single page app" - so all the "diff'ing" and other app logic is happening in the browser without any backend server.  

* **[tikoci/postman-code-generators](https://github.com/tikoci/postman-code-generators)** contains fork from Postman adding RouterOS `/tool/fetch` snippet support & also the [`curl2rsc` website](https://tikoci.github.io/postman-code-generators)
  > The `curl2rsc` webpage takes a different approach than `restraml`.  It uses [HTMX](https://htmx.org), instead of local JavaScript events to handle UI logic.  With HTMX using a [glitch.com](https://glitch.com) backend providing a `/curl` endpoint that utilizes this project's [RouterOS "codegen" library](https://github.com/tikoci/postman-code-generators/tree/develop/codegens/routeros-fetch), with [curl-to-postman] module, to do code generation on the backend.

* **[tikoci/winbox-deb](https://github.com/tikoci/winbox-deb)** uses `Makefile` to create a `.deb` linux package with WinBox 4.0, including adding icon to desktop.  Provided mainly as an _example for others_ wanting to package WinBox 4.0 for various distros and "app stores".  
  > The `.deb` built is **not intended for wide redistribution** – more a template for future winbox packaging. 


### _Functional_ RouterOS Scripts

Various _maybe_ good examples of RouterOS scripting function:

* **[🧐 example of automating VLAN creation/removal/inspecting using $mkvlan/$rmvlan/$catvlan...](https://forum.mikrotik.com/viewtopic.php?t=214189&hilit=lsbridge#p1123276)** - VLAN automation script on RouterOS to add L3 VLANs and manage bridge ports/vlans, scripts can be found in [autovlan.rsc](scripts/autovlan.rsc) which has the various $mkvlan, $rmvlan, $catvlan, ... function _(requires 7.17+)_.  With a prototype script for  "visualizing the bridge": [lsbrdige.rsc](scripts/lsbridge.rsc) _(requires 7.18+)_

* **[`$PIANO`](https://forum.mikrotik.com/viewtopic.php?p=1058665)** - interactive "player piano" & studio-quality recorder using :beep

* **[`$INQUIRE`](https://forum.mikrotik.com/viewtopic.php?t=197695)** - prompt user for input using arrays +**[`$CHOICES`](https://forum.mikrotik.com/viewtopic.php?t=197695#p1013583)** +**[`$QKEYS`](https://forum.mikrotik.com/viewtopic.php?t=197695#p1081024)**

* **[`$ROKU`](https://forum.mikrotik.com/viewtopic.php?p=1063466)** - the missing Roku TV remote for RouterOS

* **[`$ZT2DNS`](https://forum.mikrotik.com/viewtopic.php?t=204990)** - import ZeroTier Members into Mikrotik DNS, with [6PLANE](https://forum.mikrotik.com/viewtopic.php?t=204990#p1078036) support 

* **[`$npushover`](https://forum.mikrotik.com/viewtopic.php?t=136256#p1083224)** - send messages to https://pushover.net and providing an example of using JSON, arrays, and `/tool/fetch` 

* **[`$updateDynu`](https://forum.mikrotik.com/viewtopic.php?t=208272&p1079713)** - enables updating IP to DNS mappings at https://www.dynu.com for DDNS support

* **[Track LTE Signal using The Dude](https://forum.mikrotik.com/viewtopic.php?t=192103)** is not really a RouterOS function - but provides an example of The Dude's `array_element()` and `oid_column()` functions to handle name to OID mapping.

> Please see Mikrotik's [Scripting Language Manual](https://help.mikrotik.com/docs/display/ROS/Scripting) for more details on the syntax and structure, and [basic examples](https://help.mikrotik.com/docs/display/ROS/Scripting+examples).
>
> For more practical scripts and examples, see [✂ Rextended Fragments of Snippets](https://forum.mikrotik.com/viewtopic.php?t=177551)




### Upcoming Projects

The following projects are in hooper:

* **RouterOS "Functional Repo"**  Various, potentially useful, scripts are littered here and [forum](https://forum.mikrotik.com).  Part of the original idea of TIKOCI was to store them, in one place, and allow simple downloads.  Eventually, more scripts will be published on  `tikoci.github.com`.

* **[Traefik Proxy](https://traefik.io/traefik/) Container _with for CORS & WASM_**  Traefik seems like a better fit for adding HTTP frontend on RouterOS, than the previous [tikoci/ngnix](https://github.com/tikoci/ngnix) approach.  While Traefik's DockerHub image work on RouterOS as-is — setup, configuration, and log viewing are [greatly aided by scripting](https://forum.mikrotik.com/viewtopic.php?p=1081289&hilit=traefik&sid=210f6f07854850cfd0310e4666640003#p1077850).  The _longer term_ goal is to integrate Grain WASM [tikoci/traefik-wasm-grain](traefik-wasm-grain) plugin, as basis for policy enforcement for REST APIs (e.g. RouterOS REST support), using Traefik 3.0's WASM support.




### <mark>FUN</mark> - How do use pronounce "tikoci"?


Who knows. Originally it was for "Tik" for Mikrotik & "OCI" since that's the container storage type.  But, ChatGPT had some suggestions on other IPA interpolations (${ipaPronunciations}) – with **tiˈkosi** being advised as most pronounceable for a worldwide audience.  For English-only audience, ChatGPT thought **tɪˈkɔʃi** might be best.  But you can you can decide for yourself: 

```js
const selectIPA = view(Inputs.select([...ipaPronunciations, ""], { value: "", label: "Play IPA using HTML5 TTS:"}));
```

```js
const ssmlIPA = selectIPA ? `<speak><voice gender="female" languages="en-US">Welcome to</voice><voice gender="male"><prosody pitch="high" rate="high"  range="high"><phoneme alphabet="ipa" ph="${selectIPA}">tikoci</phoneme></prosody></voice></speak>` : ""
```

```js
const spoken = window.speechSynthesis.speak(new SpeechSynthesisUtterance(ssmlIPA))
```

### Credits and Colophon

Various repos make use of great work by others.  Specifically, and in no order:
* Both `restraml` and `curl2rsc` use a few projects and libraries that enable the page:
  * [PicoCSS](https://picocss.com) to enable a "minimal CSS framework for semantic HTML"
  * [highlight.js](https://highlightjs.org)
  * [deep-diff](https://github.com/flitbit/diff)
  * [json-diff](https://github.com/andreyvit/json-diff)
  * [jsonpath](https://github.com/dchester/jsonpath)
* Many repos here use RouterOS scripts.  While specific contributions are noted in the specific scripts/projects, thanks [@rextended](https://forum.mikrotik.com/viewtopic.php?t=177551) & others on Mikrotik scripting forum for the many examples. 
* `curl2rsc` webpage in [`tikoci/postman-code-generator`](https://github.com/tikoci/postman-code-generator/index.html) uses [HTMX](https://htmx.org), with [glitch.com](https://glitch.com) providing a backend web service needed to run Postman's `curl-to-postman` and `postman-collection` modules under nodeJS.
* [EvilFreelancer/docker-routeros](https://github.com/EvilFreelancer/docker-routeros)'s "CHR+QEMU-in-Docker" project is used to in extracting RouterOS `/console/inspect` data from a CHR running within a [GitHub Action](https://github.com/tikoci/restraml/blob/bda495263bb4ec6c11ab460054ca2e90777104a1/.github/workflows/manual-using-extra-docker-in-docker.yaml#L37) and used by `tikoci/restraml`'s schema generation code.
* `tikoci/fat-chr` just re-builds a CHR image but relies on a script with some incantation of `qemu-img`/`gdisk` - but the scripts themselves come from @jaclaz and @kriznos, with @sindy providing QA+mgmt, in a Mikrotik [forum discussion](https://forum.mikrotik.com/viewtopic.php?t=184254&hilit=eufi).
* `tikoci.github.io` uses the [Observable Framework](https://observablehq.com/framework/) and GitHub Pages to build the TIKOCI website, which will be developed more in future. 
* `tikoci/winbox-deb` is largely borrowed from @eworm and others's [Arch winbox package](https://aur.archlinux.org/packages/winbox), specifically the `.desktop` file.
* [Stuart Feldman](https://en.wikipedia.org/wiki/Stuart_Feldman), creator of original UNIX `make` & GNU's excellent [documentation](https://www.gnu.org/software/make/) covering it.  Despite `Makefile`'s being ~50 years old, it allows the nifty (IMO) containerization approach used in `tikoci/netinstall` project – which is just [66 lines of `Makefile` code](https://github.com/tikoci/netinstall/blob/master/Makefile).  And, `make` also acts the "runtime" inside the container to **both** do operations and handle options via `cmd=` or env vars.  
* In the esoteric, `traefik-wasm-grain` is an experimental [WASM plugin for Traefik](https://plugins.traefik.io/plugins/666374dee8d831193077b35b/example-wasm-plugin-using-grain), built with [Grain](https://grain-lang.org) language & runs as RouterOS Traefik container - but the low-level `HttpWasm` bindings would not have been possible without help from [@ospencer]( https://github.com/ospencer).
* Mikrotik's [@mrz](https://forum.mikrotik.com/memberlist.php?mode=viewprofile&u=11373) source of `/console/inspect` ["easter egg"](https://forum.mikrotik.com/viewtopic.php?t=175564#p966543) with clues that gave impetus to the various "schema tools" for RouterOS developed here.


### * Disclaimers
>
> **Use at your own risk.**  No guarantees or warranties. 
>
> **Any trademarks and/or copyrights remain the property of their respective holders**, unless specifically noted otherwise.
> Use of a term in this document should not be regarded as affecting the validity of any trademark or service mark. Naming of particular products or brands should not be seen as endorsements.
> Apple and Mac are registered trademarks of Apple Inc., registered in the U.S. and other countries and regions.
> MikroTik is a trademark of Mikrotik SIA.
> Python is a registered trademark of the PSF. 
> UNIX is a registered trademark of The Open Group.
> Docker and the Docker logo are trademarks or registered trademarks of Docker, Inc. in the United States and/or other countries. 
> Docker, Inc. and other parties may also have trademark rights in other terms used herein.
>
> **Follow any links at your own risk.**.  Various materials and code may contain links to other websites, content, or services.  Links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us.  
>
> **No liability can be accepted.**  No representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information is offered.  Use the concepts, code, examples and other content at your own risk. There may be errors and inaccuracies, that may of course be damaging to your system. Although this is highly unlikely, you should proceed with caution. The author(s) do not accept any responsibility for any damage incurred.

```js
FileAttachment("images/dalle-cubist-potto.webp").image()
```
