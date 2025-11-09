import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const banner = `/**
 * Kaomoji Replacer v${process.env.npm_package_version || '1.2.2'}
 * 基于 BM25 算法的颜文字替换插件
 * (c) ${new Date().getFullYear()} Tosd0
 * @license MIT
 */`;

const config = [
  // ES Modules build
  {
    input: 'index.js',
    output: {
      file: 'dist/kaomoji-replacer.esm.js',
      format: 'esm',
      banner
    },
    external: ['fs']
  },

  // CommonJS build
  {
    input: 'index.js',
    output: {
      file: 'dist/kaomoji-replacer.cjs.js',
      format: 'cjs',
      banner,
      exports: 'named'
    },
    external: ['fs']
  },

  // UMD build (unminified) - for browsers
  {
    input: 'index.js',
    output: {
      name: 'KaomojiReplacer',
      file: 'dist/kaomoji-replacer.umd.js',
      format: 'umd',
      banner,
      exports: 'named',
      globals: {
        'fs': 'fs'
      }
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs()
    ],
    external: ['fs']
  },

  // UMD build (minified) - for browsers
  {
    input: 'index.js',
    output: {
      name: 'KaomojiReplacer',
      file: 'dist/kaomoji-replacer.umd.min.js',
      format: 'umd',
      banner,
      exports: 'named',
      sourcemap: true,
      globals: {
        'fs': 'fs'
      }
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      terser({
        compress: {
          pure_getters: true,
          unsafe: true,
          unsafe_comps: true
        }
      })
    ],
    external: ['fs']
  }
];

export default config;
