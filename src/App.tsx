import Fuse from "fuse.js";
import { For, Match, Switch, createEffect, createResource, createSignal, onMount, type Component } from "solid-js";

import styles from "./App.module.css";

interface Author {
  name: string;
  id?: string;
}

interface PluginManifest {
  name: string;
  description: string;
  authors: Author[];
  main: string;
  hash: string;
  vendetta: {
    icon?: string;
    original: string;
  };
  url: string;
  bunny?: {
    disabled: boolean;
    issueNotice: string;
  }
}

const base = "https://bunny-mod.github.io/plugins-proxy/plugins-full.json";

const getPlugins = () =>
  fetch(base)
    .then((r) => r.json())
    .then((plugins: PluginManifest[]) => {
      return plugins.sort((a, b) => {
        const isAlphabetA = /^[A-Za-z]/.test(a.name);
        const isAlphabetB = /^[A-Za-z]/.test(b.name);

        if (isAlphabetA && isAlphabetB) {
          return a.name.localeCompare(b.name);
        }
        return isAlphabetA ? -1 : 1;
      }).map((p) => {
        return {
          ...p,
          url: new URL(p.vendetta.original, base).href,
        }
      })
    });

const fuzzy = <T extends unknown[]>(set: T, search: string) =>
  !search
    ? set
    : (new Fuse(set, {
      threshold: 0.3,
      useExtendedSearch: true,
      keys: ["name", ["authors", "name"]],
    })
      .search(search)
      .map((searchResult) => searchResult.item) as T);

const debounce = (fn: (...args: any[]) => any, ms = 1000) => {
  let timeoutId: number;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

const extractRepo = (url: string): string | null => {
  const matches = url.match(/https\:\/\/bunny-mod\.github\.io\/plugins-proxy\/(.+)\.github\.io\/(.+)\/.+/);
  return matches ? `${matches[1]}/${matches[2]}` : null;
}

async function copyText(str: string) {
  try {
    await navigator.clipboard.writeText(str);
  } catch {
    const copyArea = document.createElement("textarea");

    // Try our best to hide the element, visibility: hidden makes it break on some browsers.
    copyArea.style.width = '0';
    copyArea.style.height = '0';
    copyArea.style.position = "absolute";
    copyArea.style.top = `${window.pageYOffset || document.documentElement.scrollTop}px`;
    copyArea.style.left = "-9999px";

    copyArea.setAttribute("readonly", "");
    copyArea.value = str;

    document.body.appendChild(copyArea);
    copyArea.focus();
    copyArea.select();

    document.execCommand("copy");
    document.body.removeChild(copyArea);
  }
}

const InfoRow: Component<{ icon: string, text: string }> = (props) => {
  return <div class={styles["plugin-info-row"]}>
    <span class="material-symbols-outlined">
      {props.icon}
    </span>
    {props.text}
  </div>
}

const NoticeTop: Component<{ manifest: PluginManifest }> = (props) => {
  const { disabled, issueNotice: issueDescription } = props.manifest.bunny ?? {};
  if (!disabled && !issueDescription) return null;

  return <div class={styles["plugin-card-notice"]}>
    {disabled && <InfoRow icon={"hide_source"} text={"Temporarily disabled by a staff"} />}
    {issueDescription && <InfoRow icon={"warning"} text={issueDescription} />}
  </div>
}

const PluginCard: Component<{ manifest: PluginManifest }> = (props) => {
  const repo = extractRepo(props.manifest.url);

  return (
    <div class={styles.card}>
      <NoticeTop manifest={props.manifest} />
      <div class={styles.title}>{props.manifest.name}</div>
      <div class={styles.desc}>{props.manifest.description}</div>
      <div class={styles.bottom}>
        <div class={styles.authors}>{props.manifest.authors.map((a: Author) => a.name).join(", ")}</div>
        {repo && <button onClick={() => open(`https://github.com/${repo}`, '_blank')?.focus()} class={styles.btn}>
          Visit repo
        </button>}
        <button onClick={() => copyText(props.manifest.url)} class={styles.btn}>
          Copy link
        </button>
      </div>
    </div>
  );
};

const App: Component = () => {
  const [data] = createResource<PluginManifest[]>(getPlugins);
  const [search, setSearch] = createSignal(decodeURIComponent(location.hash.slice(1)));

  const updateHash = debounce(() => history.replaceState(undefined, "", `#${encodeURIComponent(search())}`));
  createEffect(() => (search(), updateHash()));

  let input: HTMLInputElement | undefined;
  onMount(() => {
    input?.focus();
  });

  const results = () => fuzzy(data() ?? [], search());

  return (
    <div>
      <h1 class={styles.header}>
        Vendetta Plugins
        <div class={styles.notice}>
          This list is maintained by the <a href="https://github.com/pyoncord">Pyoncord</a> team.
        </div>
      </h1>
      <div class={styles.search}>
        <input
          placeholder="Search..."
          class={styles.input}
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          ref={input}
        />
      </div>
      <div class={styles.list}>
        <Switch fallback={<div>Loading...</div>}>
          <Match when={data.state === "errored"}>
            <div>Could not fetch plugins</div>
          </Match>
          <Match when={data.state === "ready"}>
            <For each={results()}>{(manifest) => <PluginCard manifest={manifest} />}</For>
          </Match>
        </Switch>
      </div>
    </div>
  );
};

export default App;
