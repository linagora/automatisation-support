---
title: Cozy Apps Development
sidebar_position: 1
---

This guide walks through setting up a local Cozy development environment from scratch. It covers CouchDB, the Cozy stack, and creating your first instance.

Supported platforms: macOS, Ubuntu/Debian.

## Prerequisites

- **Docker** -- [Colima](https://github.com/abiosoft/colima) (free) or [OrbStack](https://orbstack.dev/) (paid) on macOS, or native Docker on Linux ([Ubuntu](https://docs.docker.com/install/linux/docker-ce/ubuntu/) / [Debian](https://docs.docker.com/install/linux/docker-ce/debian/) / [Fedora](https://docs.docker.com/install/linux/docker-ce/fedora/))
- **[Go](https://golang.org/doc/install?download)**
- **[Homebrew](https://brew.sh/)** (macOS only)

## Install CouchDB

CouchDB is the database used by the Cozy stack. Run a single-node instance on port 5984:

```bash
docker run -d \
    --name cozy-stack-couch \
    -p 5984:5984 \
    -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=password \
    -v $HOME/.cozy-stack-couch:/opt/couchdb/data \
    couchdb:3.3

curl -X PUT http://admin:password@127.0.0.1:5984/{_users,_replicator}
```

Start the container later with `docker start cozy-stack-couch`.

Verify the installation at http://127.0.0.1:5984/_utils/#verifyinstall (login: `admin` / `password`).

## Install MailHog

The Cozy stack needs an SMTP server for user management emails. MailHog provides a local test server.

**macOS:**

```bash
brew update && brew install mailhog
mailhog
```

**Debian/Ubuntu:**

```bash
go install github.com/mailhog/MailHog@latest
~/go/bin/MailHog
```

Access captured emails at http://127.0.0.1:8025/.

When starting the stack, add: `--mail-disable-tls --mail-host localhost --mail-port 1025 --host 0.0.0.0`

If you get a `sendmail has failed: dial tcp: lookup smtp.home: no such host` error, remove `host: smtp.home` from the stack config file.

## Install ImageMagick

**macOS:**

```bash
brew install imagemagick
sudo sed -ie 's,^ \(<policy domain="coder" rights="none" pattern="PDF" />\)$, <!-- \1 -->,g' \
  /usr/local/Cellar/imagemagick/*/etc/ImageMagick-*/policy.xml
```

**Debian/Ubuntu:**

```bash
sudo apt update && sudo apt install imagemagick
sudo sed -ie 's,^ \(<policy domain="coder" rights="none" pattern="PDF" />\)$, <!-- \1 -->,g' \
  /etc/ImageMagick-*/policy.xml
```

## Install the Lato font

ImageMagick uses the Lato font for image generation. Download and install it from https://fonts.google.com/download?family=Lato.

## Install cozy-stack

Do not use the Docker-based build -- build from source instead.

```bash
git clone git@github.com:cozy/cozy-stack.git
cd cozy-stack
make
```

Add `$GOPATH/bin` to your `$PATH` so the binary is available globally:

```bash
# Add to your shell rc file (.bashrc, .zshrc, etc.)
export PATH="$(go env GOPATH)/bin:$PATH"
```

### Configure the stack

```bash
cp cozy.example.yaml $HOME/.cozy/cozy.yml
```

Edit `$HOME/.cozy/cozy.yml` and set the CouchDB connection:

```yaml
couchdb:
  url: http://admin:password@localhost:5984
```

### Create your first instance

Always start the stack from the same directory (it creates a folder for temporary files).

```bash
# Start the stack
cozy-stack serve

# Create an instance
cozy-stack instances add claude.localhost:8080 \
  --passphrase cozy \
  --apps home,store,drive,photos,settings,contacts,notes,passwords,dataproxy \
  --email claude@cozy.localhost \
  --locale en \
  --public-name Claude \
  --context-name dev
```

The instance will be available at http://claude.localhost:8080 with password `cozy`.

Add an entry to `/etc/hosts`:

```
127.0.0.1 claude.localhost
```

### Update the stack

Pull the latest changes and rebuild regularly:

```bash
cd /path/to/cozy-stack
git pull --rebase origin master
make
```

## References

- https://docs.cozy.io/en/cozy-stack/INSTALL/
- https://docs.cozy.io/en/cozy-stack/docker/
- https://docs.cozy.io/en/tutorials/app/#install-the-development-environment

## Next steps

- [Frontend Development](../cozy-apps/frontend) -- launching apps locally, working with cozy-ui and cozy-client
- [Mobile Development](../cozy-apps/mobile) -- Xcode and Visual Studio setup for iOS/Android
- [Data and cozy-client](../cozy-apps/data-and-cozy-client) -- CouchDB data model, querying and mutating data
