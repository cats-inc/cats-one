#!/usr/bin/env node
import("@cats-inc/cats-platform/cli").catch(() => {
  console.error("cats-platform is not installed. Run: npm install cats-one");
  process.exit(1);
});
