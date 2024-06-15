(() => {
    interface ModuleInfo {
        moduleName: string,
        author: string,
        version: string,
        description: string,
        buildVersion: number,
        platforms: string[]
    }
    
    interface InputElement {
        id: string,
        inputType: string,
        returnValue?: any
    }
    
    interface ChangeEvent {
        id: string,
        attribute: string,
        value: any
    }

    const MODULE_NAME = "Settings"
    const MODULE_PROCESS_NAME = MODULE_NAME.toLowerCase() + "-process";
    const MODULE_RENDERER_NAME = MODULE_NAME.toLowerCase() + "-renderer"
    const sendToProcess = (eventType: string, ...data: any): void => {
        window.parent.ipc.send(MODULE_PROCESS_NAME.toLowerCase(), eventType, ...data);
    }

    sendToProcess("settings-init");


    let currentlySelectedTab: HTMLElement = undefined;

    const moduleList: HTMLElement = document.getElementById("left");
    const settingsList: HTMLElement = document.getElementById("right");

    window.parent.ipc.on(MODULE_RENDERER_NAME, (_, eventType: string, ...data: any[]) => {
        switch (eventType) {
            case "populate-settings-list": {
                populateSettings(data[0]);
                break;
            }
            case "setting-modified": {
                const event: ChangeEvent[] = data[0]

                for (const group of event) {
                    const element: any = document.getElementById(group.id);
                    element[group.attribute] = group.value

                }


                break;
            }
            case "refresh-settings": {
                const newAccentColor: string = data[0];
                const root: any = window.parent.document.querySelector(':root');

                root.style.setProperty('--accent-color', newAccentColor);
                const contentChildren: HTMLCollection = window.parent.document.body.querySelector(".content").children;

                for (let i = 0; i < contentChildren.length; i++) {
                    const child: any = contentChildren.item(i);
                    if (contentChildren.item(i).tagName.toLowerCase() === "iframe") {
                        child.contentWindow
                            .document.querySelector(":root")
                            .style.setProperty('--accent-color', newAccentColor)
                    }
                }

                break;
            }

            case "swap-tab": {
                swapTabs(data[0]);
                break;
            }
        }
    });

    function populateSettings(data: { module: string, moduleInfo: any }[]): void {
        let firstModule: HTMLElement;

        data.forEach((obj: { module: string, moduleInfo: any }) => {
            const moduleName: string = obj.module;

            // Setting group click button
            const groupElement: HTMLElement = document.createElement("p");
            groupElement.innerText = moduleName;
            groupElement.addEventListener("click", () => {
                if (currentlySelectedTab !== undefined) {
                    currentlySelectedTab.style.color = "";
                }
                currentlySelectedTab = groupElement;
                currentlySelectedTab.setAttribute("style", "color: var(--accent-color);")

                sendToProcess('swap-settings-tab', moduleName);
            });

            if (firstModule === undefined) {
                firstModule = groupElement;
            }

            moduleList.insertAdjacentElement("beforeend", groupElement);
        });
        firstModule.click();
    }

    const inputTypeToStateMap: Map<string, string> = new Map([
        ['text', 'value'],
        ['number', 'value'],
        ['password', 'value'],
        ['checkbox', 'checked'],
        ['radio', 'checked'],
        ['button', 'value'],
        ['submit', 'value'],
        ['file', 'files'],
        ['color', 'value'],
        ['date', 'value'],
        ['range', 'value'],
        ['select', 'value']
    ]);

    const keyBlacklist: string[] = [
        'moduleName', 'module_name',
        'buildVersion', 'build_version',
    ];


    function swapTabs(tab: any): void {
        function getModuleInfoHTML(moduleInfo: any): string {
            const toSentenceCase = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);
            const inner: string[] = [];
            inner.push(`<p style="font-size: 27px; color: var(--accent-color);">${moduleInfo.moduleName || tab.module}</p>`);
            for (const key in moduleInfo) {
                if (keyBlacklist.includes(key)) {
                    continue;
                }

                const value: any = moduleInfo[key];
                if (!value || value.length === 0) {
                    continue;
                }

                if (key.toUpperCase() === "LINK") {
                    inner.push(`<p><span>${toSentenceCase(key)}: </span><a href=${value}>${value}</a><p/>`);
                    continue;
                }


                inner.push(`<p><span>${toSentenceCase(key)}:</span> ${value}</p>`);
            }

            return inner.reduce((acc, html) => acc += html + "\n", '');
        }


        // Clear existing settings
        while (settingsList.firstChild) {
            settingsList.removeChild(settingsList.firstChild);
        }

        const moduleInfo: ModuleInfo = tab.moduleInfo;

        if (moduleInfo !== undefined) {
            const moduleInfoHTML: string = `
                <div class='module-info'>
                    ${getModuleInfoHTML(moduleInfo)}
                </div>
            `
            settingsList.insertAdjacentHTML("beforeend", moduleInfoHTML);
        }

        tab.settings.forEach((settingInfo: any) => {
            const settingId: string = settingInfo.settingId;
            const inputTypeAndId: InputElement[] = settingInfo.inputTypeAndId;
            const html: string = settingInfo.ui;
            const [sourceObject, style]: string[] = settingInfo.style;


            settingsList.insertAdjacentHTML("beforeend", html);

            // Attach events to reset button
            const resetButton: HTMLElement = document.getElementById(`reset-button_${settingId}`);
            resetButton?.addEventListener("click", () => {
                sendToProcess("setting-reset", inputTypeAndId[0].id);
            });

            // Add custom setting css to setting
            if (style !== "") {
                const styleId = sourceObject;
                if (document.getElementById(styleId) === null) {
                    const styleSheet: HTMLElement = document.createElement('style')
                    styleSheet.id = sourceObject;
                    styleSheet.innerHTML = style
                    settingsList.appendChild(styleSheet);
                }
            }

            inputTypeAndId.forEach((group: InputElement) => {
                const id: string = group.id;
                const inputType: string = group.inputType;
                const returnValue: string | undefined = group.returnValue;
                let attribute: string = inputTypeToStateMap.get(inputType);

                if (attribute === undefined) {
                    console.error('Invalid input type found: ' + inputType);
                    console.error('Attempting to assign it "value"');
                    attribute = 'value';
                }



                const element: HTMLElement = document.getElementById(id);

                switch (inputType) {
                    case 'number':
                    case 'text': {
                        element.addEventListener('keyup', (event: KeyboardEvent) => {
                            if (event.key === "Enter") {
                                sendToProcess("setting-modified", id, returnValue ? returnValue : (element as any)[attribute]);
                                element.blur();
                            }
                        });

                        element.addEventListener('blur',
                            () => sendToProcess("setting-modified", id, returnValue ? returnValue : (element as any)[attribute]));

                        break;
                    }
                    case 'color':
                    case 'range': {
                        element.addEventListener('input',
                            () => sendToProcess('setting-modified', id, returnValue ? returnValue : (element as any)[attribute]))
                        break;
                    }
                    case "checkbox":
                    case 'select':
                    case 'radio': {
                        element.addEventListener('change', () => {
                            sendToProcess('setting-modified', id, returnValue ? returnValue : (element as any)[attribute])
                        })
                        break;
                    }
                    // TODO: Add additional options
                }


            });

        });

        // Add spacers to the bottom
        const spacerHTML: string = `
            <br/>
            <br/>
        `

        settingsList.insertAdjacentHTML("beforeend", spacerHTML);

    }

    function openLinkPopup(link: string): void {
        const html: string = `
            <div class="dialog">
                <h3 class='disable-highlight'>You are navigating to an external website.</h3>
                <h4 class='link'>${link}</h4>
                <h4 style="padding-top: 10px;" class='disable-highlight'>Only visit the site if you trust it.</h4>

                <div style="display: flex; justify-content: space-between; margin: 0px 15px; margin-top: 15px;">
                    <h3 class='disable-highlight' id='dialog-cancel'>Cancel</h3>
                    <h3 class='disable-highlight' id='dialog-proceed'>Proceed</h3>
                </div>
            </div>
        `

        const div: HTMLElement = document.createElement("div");
        div.classList.add('overlay')
        div.innerHTML = html

        document.body.prepend(div)


        div.addEventListener('click', (event) => {
            if ((event.target as HTMLElement).className.includes('overlay')) {
                div.remove();
            };
        });

        div.querySelector('#dialog-cancel').addEventListener('click', () => div.remove());

        div.querySelector('#dialog-proceed').addEventListener('click', () => {
            sendToProcess("open-link", link);
            div.remove();
        });

    }



    dragElement(document.getElementById("separator"));

    function dragElement(element: HTMLElement) {
        let md: any;
        const left: HTMLElement = document.getElementById("left");
        const right: HTMLElement = document.getElementById("right");

        element.onmousedown = (e: MouseEvent) => {
            md = {
                e,
                offsetLeft: element.offsetLeft,
                offsetTop: element.offsetTop,
                firstWidth: left.offsetWidth,
                secondWidth: right.offsetWidth
            };

            document.onmousemove = (e: MouseEvent) => {
                let delta: { x: number, y: number } = {
                    x: e.clientX - md.e.clientX,
                    y: e.clientY - md.e.clientY
                };

                delta.x = Math.min(Math.max(delta.x, -md.firstWidth), md.secondWidth);

                element.style.left = md.offsetLeft + delta.x + "px";
                left.style.width = (md.firstWidth + delta.x) + "px";
                right.style.width = (md.secondWidth - delta.x) + "px";
            };
            document.onmouseup = () => {
                document.onmousemove = document.onmouseup = null;
            }
        };
    }

    document.body.addEventListener('click', event => {
        if ((event.target as HTMLElement).tagName.toLowerCase() === 'a') {
            event.preventDefault();
            openLinkPopup((event.target as HTMLAnchorElement).href)
        }
    });
})();



