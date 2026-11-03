const { codeInspectorPlugin } = require('code-inspector-plugin');

const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.plugins.push(codeInspectorPlugin({ bundler: 'webpack' }));
    }
    return config;
  },
};

module.exports = nextConfig;