---
toc: true 
---

# `TIKOCI` — RouterOS Project Depot

```js
const ipaPronunciations = [
    "tiˈkoʊʃi", // "tee-KOH-shee"
    "tɪˈkɔʃi", // "tih-KAW-shee"
    "tiˈkosi", // "tee-KOH-see"
    "tɪ'koʃi", // "tih-KOH-shee"
    "tiˈkɔʧi", // "tee-KAW-chee"
    "tiˈkoʊʧi" // "tee-KOH-chee"
  ];
```

Various Open Source Mikrotik RouterOS projects, generally focused on `/container` and scripting.  See each repos for details.

### Web Tools

* #### `diff` RouterOS CLI commands to see changes in commands across versions
  ##### https://tikoci.github.io/restraml
  > The [tikoci/restraml](https://github.com/tikoci/restraml) project provides a web pages that allows picking two RouterOS versions to see what commands have changed in the CLI.  
* #### `curl2rsc` - Convert a `curl` command into the 
  ##### https://tikoci.github.io/postman-code-generators
  > The project is mainly code for Postman's "Code Snippet" to support `/tool/fetch`, but a website inside the project uses [postmanlabs/curl-to-postman](https://github.com/postmanlabs/curl-to-postman) to convert curl into Postman JSON, which is then converted using [tikoci/restraml](https://github.com/tikoci/postman-code-generators) convert to generate the right RouterOS command.  Various "output styles" are support on the `curl2rsc` webpage, to provide examples of `/tool/fetch` in a variety of use cases.


### RouterOS REST API Schemas (and Postman App support)

The [tikoci/restraml](https://github.com/tikoci/restraml) pages has various API schemes (RAML, OpenAPI 2.0) for RouterOS's REST API available for download.  The schemes are arranged by version, and can be used in most Web API tools, like Postman App.  Specific instruction to use with Postman App, can be found on the Mikrotik Forum: [
REST API schema for Postman & more](https://forum.mikrotik.com/viewtopic.php?t=199476).


### Current Projects 

* **[tikoci/netinstall](https://github.com/tikoci/netinstall)**  runs Mikrotik's netinstall tool as a RouterOS container, and QEMU to enable it for ARM/ARM64.   This netinstall container uses UNIX `make` to download packages needed _automatically_ via provided `/container/env` on-demand.  Also available on [DockerHub](https://hub.docker.com/r/ammo74/netinstall).

* **[tikoci/restraml](https://github.com/tikoci/restraml)** is not a container, but contains API schemas for various RouterOS versions, using [CHR in GitHub Action](https://github.com/tikoci/restraml/actions/runs/9308686567/job/25624622673) to build the schemas.  Check out the [RouterOS Command `diff` Tool](https://tikoci.github.io/restraml) to see changes in commands across versions.

* **[tikoci/serial2http](https://github.com/tikoci/serial2http)** wraps RouterOS "remote" serial port as HTTP interface.

* **[tikoci/cligames](https://github.com/tikoci/cligames)** old BSD game collections, wrapped into RouterOS container, with `telnet` interface.

* **[tikoci/fat-chr](https://github.com/tikoci/fat-chr)** rebuilds RouterOS packages, into a valid UEFI image for UTM/Apple/other virtualization platforms.

* **[tikoci/winbox-deb](https://github.com/tikoci/winbox-deb)** use Makefile to create a `.deb` linux package with WinBox 4.0, including adding icon to desktop.

* **[tikoci/postman-code-generators](https://github.com/tikoci/postman-code-generators)** fork from Postman to add RouterOS `/tool/fetch` snippet support & also supports curl2rsc website.


### Upcoming Projects

The following projects are in hooper:

* **RouterOS Function Repo**  Various, potentially useful, scripts are littered here and [forum](https://forum.mikrotik.com).  Part of the original idea of this GitHub project was to store them, in one place, and allow download.  Eventually more scripts will be published on the `tikoci.github.com` main page.

* **[Traefik Proxy](https://traefik.io/traefik/) Container _with for CORS & WASM_**  Traefik seem like a better fit for adding HTTP frontend on RouterOS, than the previous [tikoci/ngnix](https://github.com/tikoci/ngnix) approach.  While Traefik's DockerHub image work on RouterOS as-is — setup, configuration, and log viewing are greatly aided with scripting.  The _longer term_ goal is integrate Grain WASM [tikoci/traefik-wasm-grain](traefik-wasm-grain) plugin code, as basis for policy enforcement for REST APIs (e.g. RouterOS REST support), using Traefik 3.0's WASM support.




### <mark>FUN</mark> - How do use pronounce "tikoci"?


Who knows. ChatGPT suggested some IPA interpolations (${ipaPronunciations}), with **tiˈkosi** being the most friendly for a worldwide audience.  The site maintainer perfers **tɪˈkɔʃi**.  But you can you can decide for yourself: 

```js
const selectIPA = view(Inputs.select([...ipaPronunciations, ""], { value: "", label: "Pick one to play using HTML5 TTS:"}));
```

```js
const ssmlIPA = selectIPA ? `<speak><voice gender="female" languages="en-US">Welcome to</voice><voice gender="male"><prosody pitch="high" rate="high"  range="high"><phoneme alphabet="ipa" ph="${selectIPA}">tikoci</phoneme></prosody></voice></speak>` : ""
```

```js
const spoken = window.speechSynthesis.speak(new SpeechSynthesisUtterance(ssmlIPA))
```

### * Disclaimers
>
> **Use at your own risk.**  No guarantees or warranties. 
>
> **Any trademarks and/or copyrights remain the property of their respective holders**, unless specifically noted otherwise.
> Use of a term in this document should not be regarded as affecting the validity of any trademark or service mark. Naming of particular products or brands should not be seen as endorsements.
> Apple and Mac are registered trademarks of Apple Inc., registered in the U.S. and other countries and regions.
> MikroTik is a trademarks of Mikrotikls SIA.
> Python is a registered trademark of the PSF. 
> UNIX is a registered trademark of The Open Group.
> Docker and the Docker logo are trademarks or registered trademarks of Docker, Inc. in the United States and/or other countries. 
> Docker, Inc. and other parties may also have trademark rights in other terms used herein.
>
> **Follow any links at your own risk.**.  Various materials and code may contain links to other websites, content, or services.  Links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us.  
>
> **No liability can be accepted.**  No representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information is offered.  Use the concepts, code, examples and other content at your own risk. There may be errors and inaccuracies, that may of course be damaging to your system. Although this is highly unlikely, you should proceed with caution. The author(s) do not accept any responsibility for any damage incurred.  