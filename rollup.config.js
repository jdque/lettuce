import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/playground.js',
    format: 'iife'
  },
  watch: {
    include: 'src/**'
  },
  plugins: [ resolve(), commonjs() ]
};