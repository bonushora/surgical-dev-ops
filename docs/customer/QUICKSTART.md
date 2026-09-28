# Quickstart

Requires Node.js 24.18 or newer and Git. Install the qualified artifact supplied
for the beta; a source checkout is not required.

```text
npm install --global ./surgical-dev-ops-2.6.0-rc.6.tgz
surgical init --profile developer
surgical doctor
surgical start
surgical demo
```

The demo asks for an exact, disposable authorization and never touches a real
repository. Afterward, enroll a project with `surgical open /absolute/project`.
Enrollment grants no mutation authority. Stop with `surgical stop`.
