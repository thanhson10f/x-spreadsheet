/* global window, document */
import { h } from './component/element';
import DataProxy from './core/data_proxy';
import Sheet from './component/sheet';
import Bottombar from './component/bottombar';
import { cssPrefix } from './config';
import { locale } from './locale/locale';
import Cr from './core/cell_range';

class Spreadsheet {
  constructor(selectors, options = {}) {
    this.selectors = selectors;
    let targetEl = selectors;
    this.options = { showBottomBar: true, ...options };
    this.sheetIndex = 1;
    this.datas = [];
    if (typeof selectors === 'string') {
      targetEl = document.querySelector(selectors);
    }
    this.bottombar = this.options.showBottomBar ? new Bottombar(() => {
      if (this.options.mode === 'read') return;
      const d = this.addSheet();
      this.sheet.resetData(d, this.datas);
    }, (index) => {
      const d = this.datas[index];
      this.sheet.resetData(d, this.datas);
    }, () => {
      this.deleteSheet();
    }, (index, value) => {
      this.datas[index].name = value;
      this.sheet.trigger('change');
    }) : null;
    this.data = this.addSheet();
    const rootEl = h('div', `${cssPrefix}`)
      .on('contextmenu', evt => evt.preventDefault());
    // create canvas element
    targetEl.appendChild(rootEl.el);
    this.sheet = new Sheet(rootEl, this.data, this.datas);
    if (this.bottombar !== null) {
      rootEl.child(this.bottombar.el);
    }
  }

  addSheet(name, active = true) {
    const n = name || `Sheet${this.sheetIndex}`;
    const d = new DataProxy(n, this.options);
    d.change = (...args) => {
      this.sheet.trigger('change', ...args);
    };
    this.datas.push(d);
    // console.log('d:', n, d, this.datas);
    if (this.bottombar !== null) {
      this.bottombar.addItem(n, active, this.options);
    }
    this.sheetIndex += 1;
    return d;
  }

  deleteSheet() {
    if (this.bottombar === null) return;

    const [oldIndex, nindex] = this.bottombar.deleteItem();
    if (oldIndex >= 0) {
      this.datas.splice(oldIndex, 1);
      if (nindex >= 0) this.sheet.resetData(this.datas[nindex]);
      this.sheet.trigger('change');
    }
  }

  loadData(data) {
    const ds = Array.isArray(data) ? data : [data];
    if (this.bottombar !== null) {
      this.bottombar.clear();
    }
    this.datas = [];
    this.sheetIndex = 1; // reset sheet index
    if (ds.length > 0) {
      for (let i = 0; i < ds.length; i += 1) {
        const it = ds[i];
        const nd = this.addSheet(it.name, i === 0);
        nd.setData(it);
        if (i === 0) {
          this.sheet.resetData(nd, this.datas);
        }
      }
    }
    return this;
  }

  getData() {
    return this.datas.map(it => it.getData());
  }

  cellText(ri, ci, text, sheetIndex = 0) {
    this.datas[sheetIndex].setCellText(ri, ci, text);
    return this;
  }

  resetCellText(sri, sci, eri, eci, sheetIndex = 0, reRender = true) {
    const cr = new Cr(sri, sci, eri, eci);
    cr.each((ri, ci) => {
      this.datas[sheetIndex].setCellText(ri, ci);
    });
    if (reRender) {
      this.reRender();
    }
  }

  cell(ri, ci, sheetIndex = 0) {
    return this.datas[sheetIndex].getCell(ri, ci);
  }

  cellStyle(ri, ci, sheetIndex = 0) {
    return this.datas[sheetIndex].getCellStyle(ri, ci);
  }

  reRender() {
    this.sheet.table.render();
    return this;
  }

  setCellStyle(ri, ci, style, sheetIndex = 0, reRender = true) {
    this.datas[sheetIndex].setCellStyle(ri, ci, style);
    if (reRender) {
      this.reRender();
    }
  }

  highlightCell(ri, ci, { error = false, color = '#ffff01' } = {}, sheetIndex = 0, reRender = true) {
    this.setCellStyle(ri, ci, { bgcolor: error ? '#fe0000' : color }, sheetIndex, reRender);
  }

  resetCellStyle(sri, sci, eri, eci, sheetIndex = 0, reRender = true) {
    const cr = new Cr(sri, sci, eri, eci);
    cr.each((ri, ci) => {
      this.datas[sheetIndex].resetCellStyle(ri, ci);
    });
    if (reRender) {
      this.reRender();
    }
  }

  on(eventName, func) {
    this.sheet.on(eventName, func);
    return this;
  }

  validate() {
    const { validations } = this.data;
    return validations.errors.size <= 0;
  }

  change(cb) {
    this.sheet.on('change', cb);
    return this;
  }

  static locale(lang, message) {
    locale(lang, message);
  }

  static getInstance(selectors, options = {}) {
    if (!Spreadsheet.instance || Spreadsheet.instance.selectors !== selectors) {
      delete Spreadsheet.instance; // clean up old instance if any
      Spreadsheet.instance = new Spreadsheet(selectors, options);
    }
    Spreadsheet.instance.options = { ...this.options, ...options };
    Spreadsheet.instance.reRender();
    return Spreadsheet.instance;
  }
}

const spreadsheet = (el, options = {}) => new Spreadsheet(el, options);

export default Spreadsheet;
export {
  spreadsheet,
};
