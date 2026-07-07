---
title: Mobile Development
sidebar_position: 4
---

This guide covers setting up the development environment for Cozy mobile apps such as [cozy-pass-mobile](https://github.com/cozy/cozy-pass-mobile).

## Prerequisites

- A working [Cozy stack environment](../cozy-apps/)
- macOS (required for iOS development)

## Install Xcode

Xcode is required for compiling iOS projects.

1. Open the App Store
2. Search for and install Xcode

## Install Visual Studio for Mac

Visual Studio for Mac is used to compile both iOS and Android Cozy mobile projects.

1. Download from https://visualstudio.microsoft.com/vs/mac/
2. Run the installer and check the **mobile development** options (other options are optional)

### Troubleshooting

**Visual Studio does not detect Xcode:**

Go to Preferences > Projects > SDK Locations > Apple and replace `/Library/Developer/CommandLineTools` with `/Applications/Xcode.app/`.

**Visual Studio does not detect simctl:**

Open Xcode, go to Preferences > Locations, and set the Command Line Tools dropdown to your installed Xcode version.
