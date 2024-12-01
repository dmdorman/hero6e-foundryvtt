# Contributing

Everyone's contributions are welcome. Everything from bug reports to spelling corrections to bug fixes to implementing new features is needed. It takes a village to raise a Foundry package!

## So I'm Interested in Helping! What do I need?

### Contributing Bug Reports

If you would like to report a bug then the GitHub [Quickstart for GitHub Issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/quickstart) is a good starting point. To do so, you won't need anything more than a web browser, a keen eye, and a willingness to help others reproduce your problem by providing as detailed a description of the problem as you can. Learning how to use your browser's developer tools can be invaluable to look for related log messages can really make life easier and bug reports more specific.

### Contributing Source Changes

To contribute to the source you will likely need a number of things:

- A licensed copy of [FoundryVTT](https://foundryvtt.com/purchase/). Be sure to follow the [license](https://foundryvtt.com/article/license/) while developing.
- A [GitHub](https://docs.github.com/en/get-started/start-your-journey/creating-an-account-on-github) account.
- A way of editing the software and interacting with [git](https://git-scm.com/). [VSCode](https://code.visualstudio.com/download) is a free possibility but certainly not the only choice that will allow you to do both.
- A copy of at least the 5e and 6e basic rule books or the ability to ask others for your answers. Submitted code should support both 5e and 6e and usually the rules aren't too different.
- A licensed copy of [Hero Designer](https://www.herogames.com/store/product/1-hero-designer/) so that you can create test characters.
- An installed copy of [Node.js](https://nodejs.org).

#### How We Work Together

GitHub has a number of documents describing [how to collaborate with pull requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests) that are a good starting point. It looks like a lot, but it's straight forward once you get the hang of it.

In essence, you create changes in your fork and then generate a pull request to share with the main repository. A developer with write access with then ensure that it meets the the formatting and correctness criteria. This may require some back and forth as you get used to the project's requirements. Feel free to reach out with discussion questions on GitHub or Discord.

## How to Contribute Source Changes

All later steps assume you have installed the software listed above.

### Setting up FoundryVTT

There are lots of resources to help online. [Here's a starter resource focusing on the configuration and command line](https://foundryvtt.com/article/configuration/).

### Running FoundryVTT

If you plan to use both the release version and the development version of the system, then you'll want to clone into a directory that is separate from (i.e. not within) your FoundryVTT install. This is suggested approach because FoundryVTT requires that all system names are unique. You should clone into the `Data/systems` directory after you have configured your FoundryVTT and run it with the `dataPath` option as suggested below.

If you don't plan on running the release version you can clone into the `Data/systems` directory of your install. You can always move it later on if you change your mind and decide that you'd like to be able to run the released versions of the system.

You can run FoundryVTT with:

```bash
node resources/app/main.js --dataPath=<the path to the data directory or the development data directory you want to use>
```

### Downloading/Cloning for Development

You can clone the GitHub repository from `https://github.com/dmdorman/hero6e-foundryvtt` as mentioned in the [README](./README.md). The source code is made up of JavaScript, Sass, and Handlebars/HTML and documentation, such as this, is written in Markdown. You'll want to put it into a directory that is appropriate for how you're going to develop that you probably decided in an above step.

```bash
git clone https://github.com/dmdorman/hero6e-foundryvtt <your FoundryVTT data directory as above>/Data/systems/hero6efoundryvttv2
```

### Setup for Development

Open a command shell, navigate to your cloned hero6efoundryvttv2 repository, and install the npm packages used for building the project:

```bash
npm ci
```

Setup your local git repository to use the `.git-blame-ignore-revs` file so that you can ignore specific changes which made large non functional modifications to the source when using `git blame`. As documented in the `.git-blame-ignore-revs` file, you want to run:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

### Building the System

This Foundry VTT system can be built using:

```bash
npm run build
```

This will automatically leave `gulp` in watch mode which means that any of your changes will automatically rebuilt.

One this step successful executes, you should be able to run worlds using this system although you will need to restart your FoundryVTT to see this world for the first time.

### Testing

This package can be tested using the [Quench](https://foundryvtt.com/packages/quench) FoundryVTT module. Once added, make sure it's enabled and you should get a "Quench" button at the bottom of your expanded side bar. Push the button and you can choose what tests to run but ultimately all should pass.

You should be able to find the appropriate labeled tests in the `module/testing` directory. As you add new functionality or make bug fixes, you should add corresponding tests.

### Code Formatting

We have standardized the look of the code and making it harder to write incorrect code. We are doing this using [eslint](https://eslint.org/) and [stylelint](https://stylelint.io/) for linting/static analysis and [prettier](https://prettier.io/) for formatting. To validate the code, using `eslint`, `stylelint`, and `prettier`, you can run the following command:

```bash
npm run validate
```

#### Lint

Linting does a static analysis on the code to find code mistakes like using a variable name that is not defined. To check the lint status you can run and check the number of errors provided at the very end.

```bash
npm run lint
```

#### Prettier

Prettier enforces a coding standard. To check the number of code formatting errors:

```bash
npm run prettier
```

#### Prettier in your code editor

Additionally, most likely your code editor will support the prettier, via an extension, enabling you to automatically pretty your code as you develop. For instance, with VSCode you can use [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode). The only thing you will have to do is to setup your editor to auto format when commanded. I would suggest setting your editor to format on every save using the configuration in the workspace/directory so you never have code that is against the standard.

#### Auto Fixing

If you don't want to setup your editor to auto format on save, `eslint`, `stylelint`, and `prettier` can fix the formatting of your files on an as needed basis. To let them do their thing:

```bash
npm run autoFix
```

Alternatively you can run one type of fixing or the other explicitly:

```bash
npm run lint:fix
npm run prettier:fix
```
