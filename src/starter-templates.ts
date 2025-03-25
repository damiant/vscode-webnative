export interface Template {
  type: string;
  typeName: string;
  name: string;
  url?: string;
  commands?: string[];
  targets?: string;
  description: string;
}

export const starterTemplates: Template[] = [
  {
    type: 'angular-standalone',
    typeName: 'New Angular Project',
    name: 'list',
    description: 'A starting project with a list',
    targets: 'ionic-targets',
  },
  {
    type: 'angular-standalone',
    typeName: 'New Angular Project',
    name: 'blank',
    description: 'A blank starter project',
    targets: 'ionic-targets',
  },
  {
    type: 'angular-standalone',
    typeName: 'New Angular Project',
    name: 'sidemenu',
    description: 'A starting project with a side menu with navigation in the content area',
    targets: 'ionic-targets',
  },
  {
    type: 'angular-standalone',
    typeName: 'New Angular Project',
    name: 'tabs',
    description: 'A starting project with a simple tabbed interface',
    targets: 'ionic-targets',
  },
  {
    type: 'react',
    typeName: 'New React Project',
    name: 'tabs',
    description: 'A starting project with a simple tabbed interface',
    targets: 'ionic-targets',
  },
  {
    type: 'react',
    typeName: 'New React Project',
    name: 'sidemenu',
    description: 'A starting project with a side menu with navigation in the content area',
    targets: 'ionic-targets',
  },
  {
    type: 'react',
    typeName: 'New React Project',
    name: 'list',
    description: 'A starting project with a list',
    targets: 'ionic-targets',
  },
  {
    type: 'react',
    typeName: 'New React Project',
    name: 'blank',
    description: 'A blank starter project',
    targets: 'ionic-targets',
  },
  {
    type: 'vue',
    typeName: 'New Vue Project',
    name: 'list',
    description: 'A starting project with a list',
    targets: 'ionic-targets',
  },
  {
    type: 'vue',
    typeName: 'New Vue Project',
    name: 'blank',
    description: 'The official blank starter project',
    targets: 'ionic-targets',
  },
  {
    type: 'vue',
    typeName: 'New Vue Project',
    name: 'sidemenu',
    description: 'The official starting project with a side menu with navigation in the content area',
    targets: 'ionic-targets',
  },
  {
    type: 'vue',
    typeName: 'New Vue Project',
    name: 'tabs',
    description: 'The official starting project with a simple tabbed interface with Ionic Framework',
    targets: 'ionic-targets',
  },
  {
    type: 'plugin',
    typeName: 'New Capacitor Plugin',
    name: 'Starter',
    url: 'https://capacitorjs.com/docs/plugins/creating-plugins',
    description: 'The official Capacitor plugin project',
    targets: '',
  },
  {
    type: 'custom-angular',
    typeName: 'New Angular Project',
    name: 'Starter',
    url: 'https://angular.dev/installation#instructions',
    description: 'The official empty starter project for Angular',
    commands: ['npm install -g @angular/cli', 'ng new $(project-name)'],
    targets: '',
  },
  {
    type: 'custom-svelte',
    typeName: 'New Svelte Project',
    name: 'Minimal',
    url: 'https://svelte.dev/docs/svelte/getting-started',
    description: 'The official minimal starter project for Svelte',
    commands: ['npx sv create $(project-name) --template minimal --types ts --no-add-ons --no-install'],
  },
  {
    type: 'custom-svelte',
    typeName: 'New Svelte Project',
    name: 'Demo',
    url: 'https://svelte.dev/docs/svelte/getting-started',
    description: 'The official demo starter project for SvelteKit',
    commands: ['npx sv create $(project-name) --template demo --types ts --no-add-ons --no-install'],
  },
  {
    type: 'custom-svelte',
    typeName: 'New Svelte Project',
    name: 'Library',
    url: 'https://svelte.dev/docs/svelte/getting-started',
    description: 'The official starter project for SvelteKit Library',
    commands: ['npx sv create $(project-name) --template library --types ts --no-add-ons --no-install'],
  },
  {
    type: 'custom-ionic-svelte',
    typeName: 'New Svelte Project with Ionic Framework',
    name: 'Starter',
    description: 'A community starter project for Svelte with Ionic Framework',
    url: 'https://github.com/Tommertom/svelte-ionic-app',
    commands: ['npm create ionic-svelte-app@latest'], // Would be cool if we could pick package manager for this
  },
  {
    type: 'tanstack-start',
    typeName: 'New TanStack Start Project',
    name: 'Basic',
    description: 'A basic starting project with TanStack Start',
    url: 'https://tanstack.com/start/latest/docs/framework/react/quick-start',
    commands: ['npx degit https://github.com/tanstack/router/examples/react/start-basic $(project-name)'],
  },
  {
    type: 'tanstack-start',
    typeName: 'New TanStack Start Project',
    name: 'Auth',
    description: 'A basic starting project with TanStack Start with auth',
    url: 'https://tanstack.com/start/latest/docs/framework/react/quick-start',
    commands: ['npx degit https://github.com/tanstack/router/examples/react/start-basic-auth $(project-name)'],
  },
  {
    type: 'tanstack-start',
    typeName: 'New TanStack Start Project',
    name: 'Counter',
    description: 'A basic starting project with TanStack Start with a counter',
    url: 'https://tanstack.com/start/latest/docs/framework/react/quick-start',
    commands: ['npx degit https://github.com/tanstack/router/examples/react/start-basic-counter $(project-name)'],
  },
  {
    type: 'tanstack-start',
    typeName: 'New TanStack Start Project',
    name: 'React Query',
    description: 'A basic starting project with TanStack Start with a React Query',
    url: 'https://tanstack.com/start/latest/docs/framework/react/quick-start',
    commands: ['npx degit https://github.com/tanstack/router/examples/react/start-basic-react-query $(project-name)'],
  },
  {
    type: 'tanstack-start',
    typeName: 'New TanStack Start Project',
    name: 'Clerk Auth',
    description: 'A basic starting project with TanStack Start with a Clerk Auth',
    url: 'https://tanstack.com/start/latest/docs/framework/react/quick-start',
    commands: ['npx degit https://github.com/tanstack/router/examples/react/start-clerk-basic $(project-name)'],
  },
  {
    type: 'tanstack-start',
    typeName: 'New TanStack Start Project',
    name: 'Supabase',
    description: 'A basic starting project with TanStack Start with a Supabase',
    url: 'https://tanstack.com/start/latest/docs/framework/react/quick-start',
    commands: ['npx degit https://github.com/tanstack/router/examples/react/start-supabase-basic $(project-name)'],
  },
  {
    type: 'tanstack-start',
    typeName: 'New TanStack Start Project',
    name: 'Trellaux',
    description: 'A basic starting project with TanStack Start with a Trellaux',
    url: 'https://tanstack.com/start/latest/docs/framework/react/quick-start',
    commands: ['npx degit https://github.com/tanstack/router/examples/react/start-trellaux $(project-name)'],
  },
  {
    type: 'tanstack-start',
    typeName: 'New TanStack Start Project',
    name: 'Material UI',
    description: 'A basic starting project with TanStack Start with a Material UI',
    url: 'https://tanstack.com/start/latest/docs/framework/react/quick-start',
    commands: ['npx degit https://github.com/tanstack/router/examples/react/start-material-ui $(project-name)'],
  },
  {
    type: 'vite-vue',
    typeName: 'New Vite Vue Project',
    name: 'Vue',
    description: 'A starter Vue project',
    url: 'https://vite.dev/guide/',
    commands: ['npm create vite@latest $(project-name) -- --template vue'],
  },
  {
    type: 'vite-react',
    typeName: 'New Vite React Project',
    name: 'React',
    description: 'A starter React project with Typescript',
    url: 'https://vite.dev/guide/#trying-vite-online',
    commands: ['npm create vite@latest $(project-name) -- --template react-ts'],
  },
  {
    type: 'vite-preact',
    typeName: 'New Vite Preact Project',
    name: 'Preact',
    description: 'A starter Preact project ',
    url: 'https://vite.dev/guide/#trying-vite-online',
    commands: ['npm create vite@latest $(project-name) -- --template preact-ts'],
  },
  {
    type: 'vite-lit',
    typeName: 'New Vite Lit Project',
    name: 'Lit',
    description: 'A starter Lit project with Vite',
    url: 'https://vite.dev/guide/#trying-vite-online',
    commands: ['npm create vite@latest $(project-name) -- --template lit-ts'],
  },
  {
    type: 'vite-svelte',
    typeName: 'New Vite Svelte Project',
    name: 'Svelte',
    description: 'A starter Svelte project with Vite',
    url: 'https://vite.dev/guide/#trying-vite-online',
    commands: ['npm create vite@latest $(project-name) -- --template svelte-ts'],
  },
  {
    type: 'vite-solid',
    typeName: 'New Vite Solid Project',
    name: 'Typescript',
    description: 'A starter Solid project with Typescript',
    url: 'https://vite.dev/guide/#trying-vite-online',
    commands: ['npm create vite@latest $(project-name) -- --template solid-ts'],
  },
  {
    type: 'vite-solid',
    typeName: 'New Vite Solid Project',
    name: 'Javascript',
    description: 'A starter Solid project with Javascript',
    url: 'https://vite.dev/guide/#trying-vite-online',
    commands: ['npx degit solidjs/templates/js $(project-name)'],
  },
  {
    type: 'vite-web',
    typeName: 'New Web Project',
    name: 'Typescript',
    description: 'A starter Web project with Typescript',
    url: 'https://vite.dev/guide/#trying-vite-online',
    commands: ['npm create vite@latest $(project-name) -- --template vanilla-ts'],
  },
  {
    type: 'vite-web',
    typeName: 'New Web Project',
    name: 'Javascript',
    description: 'A starter Web project with Javascript',
    url: 'https://vite.dev/guide/#trying-vite-online',
    commands: ['npm create vite@latest $(project-name) -- --template vanilla'],
  },
  {
    type: 'vite-qwik',
    typeName: 'New Vite Solid Project',
    name: 'Qwik',
    description: 'A starter Qwik project with Qwik',
    url: 'https://vite.dev/guide/#trying-vite-online',
    commands: ['npm create vite@latest $(project-name) -- --template qwik-ts'],
  },
  {
    type: 'nuxt',
    typeName: 'New Nuxt Project',
    name: 'Nuxt',
    description: 'A starter Nuxt project',
    url: 'https://nuxt.com/docs/getting-started/installation',
    commands: [`npm create nuxt $(project-name) -- --packageManager npm --gitInit false --modules '@nuxt/eslint'`],
  },
  {
    type: 'astro',
    typeName: 'New Astro Project',
    name: 'Astro',
    description: 'A starter Astro project',
    url: 'https://astro.build/docs/getting-started/installation',
    commands: [
      `npm create astro@latest $(project-name) -- --add react --add tailwind --template basics --skip-houston --no-install --no-git --yes`,
    ],
  },
  {
    type: 'waku',
    typeName: 'New Waku Project',
    name: 'Waku',
    description: 'A starter Waku project',
    url: 'https://waku.gg/',
    commands: [`npm create waku@latest -- --project-name "$(project-name)"`],
  },
  {
    type: 'nextjs',
    typeName: 'New Next.js Project',
    name: 'Next.js',
    description: 'A starter Next.js project',
    url: 'https://nextjs.org/docs/getting-started',
    commands: [`npx create-next-app@latest $(project-name) --skip-install --yes --ts --eslint`],
  },
  {
    type: 'hydrogen',
    typeName: 'New Hydrogen Project',
    name: 'Tailwind',
    description: 'A starter Hydrogen project',
    url: 'https://hydrogen.shopify.dev',
    commands: [
      `npm create @shopify/hydrogen@latest --  --path $(project-name) --mock-shop --language ts --shortcut --routes --markets none --styling tailwind --no-install-deps`,
    ],
  },
  {
    type: 'hydrogen',
    typeName: 'New Hydrogen Project',
    name: 'Vanilla',
    description: 'A starter Hydrogen project',
    url: 'https://hydrogen.shopify.dev',
    commands: [
      `npm create @shopify/hydrogen@latest --  --path $(project-name) --mock-shop --language ts --shortcut --routes --markets none --styling vanilla-extract --no-install-deps`,
    ],
  },
  {
    type: 'hydrogen',
    typeName: 'New Hydrogen Project',
    name: 'CSS Modules',
    description: 'A starter Hydrogen project',
    url: 'https://hydrogen.shopify.dev',
    commands: [
      `npm create @shopify/hydrogen@latest --  --path $(project-name) --mock-shop --language ts --shortcut --routes --markets none --styling css-modules --no-install-deps`,
    ],
  },
  {
    type: 'hydrogen',
    typeName: 'New Hydrogen Project',
    name: 'Post CSS',
    description: 'A starter Hydrogen project',
    url: 'https://hydrogen.shopify.dev',
    commands: [
      `npm create @shopify/hydrogen@latest --  --path $(project-name) --mock-shop --language ts --shortcut --routes --markets none --styling postcss --no-install-deps`,
    ],
  },

  // Seems to be tied to older vue-cli-service and doesnt run
  // {
  //   type: 'nuxt-ionic',
  //   typeName: 'New Nuxt Project',
  //   name: 'Nuxt',
  //   description: 'A starter Nuxt project with Ionic Framework',
  //   url: 'https://nuxt.com/docs/getting-started/installation',
  //   commands: [`npm create nuxt $(project-name) -- --packageManager npm --gitInit false --modules '@nuxt/eslint,@nuxtjs/ionic'`],
  // },
];

export const frameworks = [
  { name: 'Angular', icon: 'angular.svg', type: 'custom-angular' },
  { name: 'Angular+Ionic', icon: 'angular.svg', icon2: 'ionic.svg', type: 'angular-standalone' },
  { name: 'Astro', icon: 'astro.svg', type: 'astro' },
  { name: 'Hydrogen', icon: 'hydrogen.svg', type: 'hydrogen' },
  { name: 'Svelte+Ionic', icon: 'svelte.svg', icon2: 'ionic.svg', type: 'custom-ionic-svelte' },
  { name: 'Svelte', icon: 'svelte.svg', icon2: 'vite.svg', type: 'vite-svelte' },
  { name: 'Svelte', icon: 'svelte.svg', type: 'custom-svelte' },
  { name: 'Preact', icon: 'preact.svg', icon2: 'vite.svg', type: 'vite-preact' },
  { name: 'Solid', icon: 'solid.svg', icon2: 'vite.svg', type: 'vite-solid' },
  { name: 'React', icon: 'react.svg', icon2: 'vite.svg', type: 'vite-react' },
  { name: 'Web', icon: 'web.svg', icon2: 'vite.svg', type: 'vite-web' },
  { name: 'Nuxt', icon: 'nuxt.svg', type: 'nuxt' },
  { name: 'Next.js', icon: 'nextjs.svg', type: 'nextjs' },
  { name: 'React+Ionic', icon: 'react.svg', icon2: 'ionic.svg', type: 'react' },
  { name: 'Qwik', icon: 'qwik.svg', icon2: 'vite.svg', type: 'vite-qwik' },
  { name: 'Lit', icon: 'lit.svg', icon2: 'vite.svg', type: 'vite-lit' },
  { name: 'Vue', icon: 'vue.svg', icon2: 'vite.svg', type: 'vite-vue' },
  { name: 'Waku', icon: 'waku.svg', type: 'waku' },
  { name: 'TanStack', icon: 'tanstack.png', type: 'tanstack-start' },
  { name: 'Capacitor Plugin', icon: 'capacitor.svg', type: 'plugin' },
  { name: 'Vue+Ionic', icon: 'vue.svg', icon2: 'ionic.svg', type: 'vue' },
];

export const targets = [
  {
    name: 'ionic-targets',
    targets: [
      { name: 'Web', icon: 'web', appearance: 'selected' },
      { name: 'iOS', icon: 'apple' },
      { name: 'Android', icon: 'android' },
    ],
  },
];
