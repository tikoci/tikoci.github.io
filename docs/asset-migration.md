# Asset migration inventory

Tracked legacy dist/scripts, dist/media, dist/logos and docs/images assets were
inventoried before migration. All 32 published files below retain identical SHA-256
content at their existing URLs. Sources now live under public/; PLACEHOLDER is
retained as a source marker. Repository references in build, workflow, README,
AGENTS, CLAUDE and Copilot guidance were updated. Old repository-tree file paths
move in git history; published asset paths stay stable.

| Public URL | SHA-256 |
| --- | --- |
| `/logos/MT_Black.svg` | `e8848d95f56ff7d98b8b89bcbb293850c919cfd74df466ab29fd070bfcd2747b` |
| `/logos/MT_Line_Black.svg` | `1003c0ae903dd4c73ab8d61251e6790e0d04a397d322a31a06d6daa092369ba9` |
| `/logos/MT_Symbol_Black.svg` | `f334b670b67c1e7db5fb0b6c9c731fedda9c6175560768bbae596896a9170cc8` |
| `/logos/MT_Symbol_Line_Black.svg` | `3972fa41c8bf6b13e9a09fac2bca0b0f0e2aa09667177ca709f236cbb0efcd7b` |
| `/media/videos/test/Make_your_router_run_Scripts-[GJ-57ByVMWk].chapters.vtt` | `524f6afe2a1b677ff51694fe2a0bcdb48400484f46d91fe5e096bf42acba202c` |
| `/media/videos/test/Make_your_router_run_Scripts-[GJ-57ByVMWk].en.vtt` | `b40ffe724546e158546c8538c80213140bfde66d85927b7cfeac145705841852` |
| `/media/videos/test/Make_your_router_run_Scripts-[GJ-57ByVMWk].hu.vtt` | `65d9d5b9f483ee928b1b90582ffad8b59ae1b7e46eca112bb6865e0bbaea6d55` |
| `/media/videos/test/Make_your_router_run_Scripts-[GJ-57ByVMWk].mp3audio.mp4` | `5490ac7d9c201883ac14f7186f899f555f73e70d7d7c54163ccf775f852fab7c` |
| `/media/videos/test/Make_your_router_run_scripts_pt.2-[2WsFhkLVaMY].chapters.vtt` | `8eb5aec53542eaedb7502b22fb677161abba1e265b1338f1af1369a1f689837c` |
| `/media/videos/test/Make_your_router_run_scripts_pt.2-[2WsFhkLVaMY].en.vtt` | `3c5538821eeb1f8217c5cd5fcf736d19bc3f14a3e8d0372a9389978b2e7515ee` |
| `/media/videos/test/Make_your_router_run_scripts_pt.2-[2WsFhkLVaMY].mp3audio.mp4` | `c63be38759e0fa5e545b0e1bde7cc8e2ae210d72dfdbd61d361e0b16b21a8d31` |
| `/media/videos/test/Python_SNMP_in_MikroTik_RouterOS-[_jZcNJSDh88].chapters.vtt` | `8eb5aec53542eaedb7502b22fb677161abba1e265b1338f1af1369a1f689837c` |
| `/media/videos/test/Python_SNMP_in_MikroTik_RouterOS-[_jZcNJSDh88].mp3audio.mp4` | `e6d97a9afaaa195a6c80651b3719904327793daefd484d94771b88cd34c41ab0` |
| `/media/videos/test/REST_API_in_RouterOS_v7-[dwEcUa2KXNc].chapters.vtt` | `8eb5aec53542eaedb7502b22fb677161abba1e265b1338f1af1369a1f689837c` |
| `/media/videos/test/REST_API_in_RouterOS_v7-[dwEcUa2KXNc].mp3audio.mp4` | `49187871b9bba162f37af1016966129eb8f24d3b1031a7a5ad60f54a02d61388` |
| `/media/videos/test/Scripting_-_variable_data_types-[9SeYC_s95rw].chapters.vtt` | `b6bd8db1cf34a271a00132df7892801175c64c31d59c4456f0f37c6c2ee51a11` |
| `/media/videos/test/Scripting_-_variable_data_types-[9SeYC_s95rw].en.vtt` | `0da4116770b2cf4de64a9b796d9ad2ce2f42cf73d825e7a443d9fb67cfb28b9e` |
| `/media/videos/test/Scripting_-_variable_data_types-[9SeYC_s95rw].mp3audio.mp4` | `3ffcc7be48a0ab78c692fa6e6f629f1c715e2936794a2c82d7cacb73cd87e223` |
| `/media/videos/test/Scripting_-_working_with_Arrays-[eWCJw0uZ-lE].chapters.vtt` | `50689ec66484d1ad768e2a2a6c0045680ac98f2dba28123a0ac036a1b2eb71f5` |
| `/media/videos/test/Scripting_-_working_with_Arrays-[eWCJw0uZ-lE].en.vtt` | `5308ed6a6d69a7e79d3e49440c639f5546df605a56335cfedf8b7dce320291a7` |
| `/media/videos/test/Scripting_-_working_with_Arrays-[eWCJw0uZ-lE].mp3audio.mp4` | `f61e05a743b403fa604f08c9ed6ca8276a4422714691857daffcb062dff0b9c9` |
| `/media/videos/test/Scripting_-_working_with_Arrays-[eWCJw0uZ-lE].pl.vtt` | `68bb440950fc28d7d43cc9baf6289cb273e807de7443199b2043b274ae5c9df5` |
| `/media/videos/test/video.chapters.en.vtt` | `d6aa3ca983e57b12851cc281690b827cb0eabcc6e7c9f9f43a9ba36451af9e31` |
| `/media/videos/test/video.subtitles.en.vtt` | `2dce46191e8dce75673dad4027674f545dfdb482119d0a9aa2155d36c5d11f61` |
| `/media/videos/test/video.vscode.mp4` | `7e8f2281645224a65c14003ec94344d8fe32a016879fd801c08db7341609cdd0` |
| `/scripts/autovlan.rsc` | `d254302946ac68c951a6474f72fde49b712fdb03b41ac64a46009341a103c80d` |
| `/scripts/hello.rsc` | `3d56745adf09a7960c08c78d2f4b675a17fbe4afafc778582f85df59089390ad` |
| `/scripts/lsbridge.rsc` | `bb9b1201929ffb705804bbbf7bea7ed41d08b5ed665c3c0c61c5f04a43cdc253` |
| `/scripts/traefik.yaml` | `1da0aefa15e2e6c982c02513f6e3ded8c7822a1e73d3df799ad1f8c851678922` |
| `/images/chr-utm-serialopen.png` | `78e6f85ac9a3d6f811d86f860f11f664b3fa93da3a449d25e72461f6b201d6b6` |
| `/images/dalle-cubist-potto.webp` | `6590b44e487f2e79528125e11dbadd37349489963ee0e2806ad4d0bf37fdb41d` |
| `/images/lsbridge-hex-s-forum.jpeg` | `4373bf64341432b00d93ce2f025c579aa041519416a51953a61da2e4d18f26a9` |

The bundled font is newly pinned for offline builds (JetBrains Mono 2.304,
upstream GitHub release); data/fonts/OFL.txt and AUTHORS.txt accompany it.
Sitemap/Atom and repo canonical URLs now use src/CNAME; sibling restraml URLs
remain unchanged. IndexNow submits only sitemap URLs matching its configured host.

Unchanged favicon, llms.txt and verification TXT files also moved from src/
to public/ and were checked byte-for-byte at their original root URLs.
