import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const banner = `/**
 * Emoticon Replacer v${process.env.npm_package_version || '1.0.1'}
 * 基于 BM25 算法的颜文字替换插件
 * (c) ${new Date().getFullYear()} Tosd0
 * @license MIT
 */`;

const config = [
  // UMD build (unminified)
  {
    input: 'index.js',
    output: {
      name: 'EmoticonReplacer',
      file: 'dist/emoticon-replacer.umd.js',
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
  // UMD build (minified)
  {
    input: 'index.js',
    output: {
      name: 'EmoticonReplacer',
      file: 'dist/emoticon-replacer.umd.min.js',
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
