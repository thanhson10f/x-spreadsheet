import helper from './helper';
import { CellRange } from './cell_range';
import { expr2expr } from './alphabet';
import _cell from './cell';
import { formulam } from './formula';

class Rows {
  constructor({ len, height }) {
    this._ = {};
    this.len = len;
    // default row height
    this.height = height;
  }

  getHeight(ri) {
    if (this.isHide(ri)) return 0;
    const row = this.get(ri);
    if (row && row.height) {
      return row.height;
    }
    return this.height;
  }

  setHeight(ri, v) {
    const row = this.getOrNew(ri);
    row.height = v;
    return ({
      rows: {
        [ri]: { height: v },
      },
    });
  }

  unhide(idx) {
    let index = idx;
    while (index > 0) {
      index -= 1;
      if (this.isHide(index)) {
        this.setHide(index, false);
      } else break;
    }
  }

  isHide(ri) {
    const row = this.get(ri);
    return row && row.hide;
  }

  setHide(ri, v) {
    const row = this.getOrNew(ri);
    if (v === true) row.hide = true;
    else delete row.hide;
  }

  setStyle(ri, style) {
    const row = this.getOrNew(ri);
    row.style = style;
  }

  sumHeight(min, max, exceptSet) {
    return helper.rangeSum(min, max, (i) => {
      if (exceptSet && exceptSet.has(i)) return 0;
      return this.getHeight(i);
    });
  }

  totalHeight() {
    return this.sumHeight(0, this.len);
  }

  get(ri) {
    return this._[ri];
  }

  getOrNew(ri) {
    this._[ri] = this._[ri] || { cells: {} };
    return this._[ri];
  }

  getCell(ri, ci) {
    const row = this.get(ri);
    if (row !== undefined && row.cells !== undefined && row.cells[ci] !== undefined) {
      return row.cells[ci];
    }
    return null;
  }

  getCellMerge(ri, ci) {
    const cell = this.getCell(ri, ci);
    if (cell && cell.merge) return cell.merge;
    return [0, 0];
  }

  getCellOrNew(ri, ci) {
    const row = this.getOrNew(ri);
    row.cells[ci] = row.cells[ci] || {};
    return row.cells[ci];
  }

  // what: all | text | format
  setCell(ri, ci, cell, what = 'all') {
    const row = this.getOrNew(ri);
    if (what === 'all') {
      row.cells[ci] = cell;
    } else if (what === 'text') {
      row.cells[ci] = row.cells[ci] || {};
      row.cells[ci].text = cell.text;
    } else if (what === 'format') {
      row.cells[ci] = row.cells[ci] || {};
      row.cells[ci].style = cell.style;
      if (cell.merge) row.cells[ci].merge = cell.merge;
    }
  }

  setCellText(ri, ci, text) {
    const cell = this.getCellOrNew(ri, ci);
    if (cell.editable !== false) {
      cell.text = text;
      return Rows.reduceAsRows([{ ri, ci, cell }]);
    }
    return null;
  }

  // what: all | format | text
  copyPaste(srcCellRange, dstCellRange, what, autofill = false, datas = [], cb = () => {}) {
    const {
      sri, sci, eri, eci,
    } = srcCellRange;
    const dsri = dstCellRange.sri;
    const dsci = dstCellRange.sci;
    const deri = dstCellRange.eri;
    const deci = dstCellRange.eci;
    const [rn, cn] = srcCellRange.size();
    const [drn, dcn] = dstCellRange.size();
    // console.log(srcIndexes, dstIndexes);
    const cellsToPaste = [];
    let isAdd = true;
    let dn = 0;
    if (deri < sri || deci < sci) {
      isAdd = false;
      if (deri < sri) dn = drn;
      else dn = dcn;
    }
    for (let i = sri; i <= eri; i += 1) {
      if (this._[i]) {
        for (let j = sci; j <= eci; j += 1) {
          if (this._[i].cells && this._[i].cells[j]) {
            for (let ii = dsri; ii <= deri; ii += rn) {
              for (let jj = dsci; jj <= deci; jj += cn) {
                const nri = ii + (i - sri);
                const nci = jj + (j - sci);
                const ncell = helper.cloneDeep(this._[i].cells[j]);
                // ncell.text
                if (autofill && ncell && ncell.text && ncell.text.length > 0) {
                  const { text } = ncell;
                  let n = (jj - dsci) + (ii - dsri) + 2;
                  if (!isAdd) {
                    n -= dn + 1;
                  }
                  if (text[0] === '=') {
                    ncell.text = text.replace(/\$?[a-zA-Z]{1,3}\$?\d+(?!!)/g, (word) => {
                      let [xn, yn] = [0, 0];
                      if (sri === dsri) {
                        xn = n - 1;
                        // if (isAdd) xn -= 1;
                      } else {
                        yn = n - 1;
                      }
                      if (/^\d+$/.test(word)) return word;
                      return expr2expr(word, xn, yn);
                    });
                  } else if ((rn <= 1 && cn > 1 && (dsri > eri || deri < sri))
                    || (cn <= 1 && rn > 1 && (dsci > eci || deci < sci))
                    || (rn <= 1 && cn <= 1)) {
                    const result = /[\\.\d]+$/.exec(text);
                    if (result !== null) {
                      const index = Number(result[0]) + n - 1;
                      ncell.text = text.substring(0, result.index) + index;
                    }
                  }
                }
                // paste expressions
                if (ncell.text && !autofill && (ncell.text[0] === '=')) {
                  const txt = ncell.text;

                  ncell.text = what === 'text' ? _cell.render(txt, formulam, (y, x, d) => {
                    if (!d) return this.getCell(x, y).text || '';
                    const xSheet = datas.find(({ name }) => name === d);
                    if (xSheet) {
                      return xSheet.getCellTextOrDefault(x, y);
                    }
                    return '#REF!';
                  }) : ncell.text.replace(/\$?[a-zA-Z]{1,3}\$?\d+(?!!)/g, (word) => {
                    if (/^\d+$/.test(word)) return word;
                    return expr2expr(word, nci - sci, nri - sri);
                  });
                }
                cellsToPaste.push({ ri: nri, ci: nci, cell: ncell });
                cb(nri, nci, ncell);
              }
            }
          }
        }
      }
    }
    return Rows.reduceAsRows(cellsToPaste, (ri, ci, cell) => {
      this.setCell(ri, ci, cell, what);
    });
  }

  cutPaste(srcCellRange, dstCellRange) {
    const cutCellsWithDest = [];

    const destination = new CellRange(
      dstCellRange.sri,
      dstCellRange.sci,
      dstCellRange.sri + (srcCellRange.eri - srcCellRange.sri),
      dstCellRange.sci + (srcCellRange.eci - srcCellRange.sci),
    );

    srcCellRange.each((ri, ci) => {
      const cell = this.getCell(ri, ci);
      const nri = dstCellRange.sri + (parseInt(ri, 10) - srcCellRange.sri);
      const nci = dstCellRange.sci + (parseInt(ci, 10) - srcCellRange.sci);
      cutCellsWithDest.push({ to: { ri: nri, ci: nci }, cell });
      this._[ri].cells[ci] = {};
    });

    cutCellsWithDest.forEach(({ to, cell }) => {
      this._[to.ri].cells[to.ci] = cell;
    });

    const changedCells = [];

    srcCellRange.each((ri, ci) => {
      changedCells.push({ ri, ci, cell: this.getCell(ri, ci) });
    });

    destination.each((ri, ci) => {
      changedCells.push({ ri, ci, cell: this.getCell(ri, ci) || {} });
    });

    return Rows.reduceAsRows(changedCells);
  }

  // src: Array<Array<String>>
  paste(src, dstCellRange) {
    if (src.length <= 0) return ({});
    const { sri, sci } = dstCellRange;
    const changedCells = [];
    src.forEach((row, i) => {
      const ri = sri + i;
      row.forEach((cell, j) => {
        const ci = sci + j;
        this.setCellText(ri, ci, cell);
        changedCells.push({ ri, ci, cell: this._[ri].cells[ci] || {} });
      });
    });
    return Rows.reduceAsRows(changedCells);
  }

  insert(sri, n = 1) {
    const changedCells = [];
    const ndata = {};
    this.each((ri, row) => {
      let nri = parseInt(ri, 10);
      if (nri >= sri) {
        nri += n;
        this.eachCells(ri, (ci, cell) => {
          if (cell.text && cell.text[0] === '=') {
            cell.text = cell.text.replace(
              /\$?[a-zA-Z]{1,3}\$?\d+(?!!)/g,
              word => expr2expr(word, 0, n, (x, y) => (y >= sri)),
            );
          }
          changedCells.push({ ri: nri, ci, cell });
        });
      }
      ndata[nri] = row;
    });

    this._ = ndata;
    this.len += n;
    // add cells from inserted row
    this.eachCells(sri + 1, (ci) => {
      changedCells.push({ ri: sri, ci, cell: { text: null } });
    });
    return ({
      rows: {
        ...Rows.reduceAsRows(changedCells).rows,
        len: this.len,
      },
    });
  }

  delete(sri, eri) {
    const changedCells = [];
    const n = eri - sri + 1;
    const ndata = {};
    this.each((ri, row) => {
      const nri = parseInt(ri, 10);
      if (nri < sri) {
        ndata[nri] = row;
      } else if (ri > eri) {
        ndata[nri - n] = row;
        this.eachCells(ri, (ci, cell) => {
          if (cell.text && cell.text[0] === '=') {
            cell.text = cell.text.replace(
              /\$?[a-zA-Z]{1,3}\$?\d+(?!!)/g,
              word => expr2expr(word, 0, -n, (x, y) => y > eri),
            );
          }
          changedCells.push({ ri: nri - n, ci, cell });
        });
      }
    });
    this._ = ndata;
    this.len -= n;
    return ({
      rows: {
        ...Rows.reduceAsRows(changedCells).rows,
        len: this.len,
      },
    });
  }

  insertColumn(sci, n = 1) {
    const changedCells = [];
    this.each((ri, row) => {
      const rndata = {};
      this.eachCells(ri, (ci, cell) => {
        let nci = parseInt(ci, 10);
        if (nci >= sci) {
          nci += n;
          if (cell.text && cell.text[0] === '=') {
            cell.text = cell.text.replace(
              /\$?[a-zA-Z]{1,3}\$?\d+(?!!)/g,
              word => expr2expr(word, n, 0, x => x >= sci),
            );
          }
          changedCells.push({ ri: parseInt(ri, 10), ci: nci, cell });
        }
        rndata[nci] = cell;
      });
      row.cells = rndata;
      // add cells for the inserted column
      changedCells.push({
        ri: parseInt(ri, 10),
        ci: sci,
        cell: { text: null },
      });
    });
    return Rows.reduceAsRows(changedCells);
  }

  deleteColumn(sci, eci) {
    const changedCells = [];
    const n = eci - sci + 1;
    this.each((ri, row) => {
      const rndata = {};
      this.eachCells(ri, (ci, cell) => {
        const nci = parseInt(ci, 10);
        if (nci < sci) {
          rndata[nci] = cell;
        } else if (nci > eci) {
          rndata[nci - n] = cell;
          if (cell.text && cell.text[0] === '=') {
            cell.text = cell.text.replace(
              /\$?[a-zA-Z]{1,3}\$?\d+(?!!)/g,
              word => expr2expr(word, -n, 0, x => x > eci),
            );
          }
          changedCells.push({ ri: parseInt(ri, 10), ci: nci - n, cell });
        }
      });
      row.cells = rndata;
    });
    return Rows.reduceAsRows(changedCells);
  }

  // what: all | text | format | merge
  deleteCells(cellRange, what = 'all') {
    const changedCells = [];
    cellRange.each((ri, ci) => {
      changedCells.push({ ri, ci, cell: this.getCell(ri, ci) });
      this.deleteCell(ri, ci, what);
    });
    return Rows.reduceAsRows(changedCells);
  }

  // what: all | text | format | merge
  deleteCell(ri, ci, what = 'all') {
    const row = this.get(ri);
    if (row !== null) {
      const cell = this.getCell(ri, ci);
      if (cell !== null && cell.editable !== false) {
        if (what === 'all') {
          delete row.cells[ci];
        } else if (what === 'text') {
          if (cell.text === 0 || cell.text) delete cell.text;
          if (cell.value) delete cell.value;
        } else if (what === 'format') {
          if (cell.style !== undefined) delete cell.style;
          if (cell.merge) delete cell.merge;
        } else if (what === 'merge') {
          if (cell.merge) delete cell.merge;
        }
      }
    }
  }

  maxCell() {
    const keys = Object.keys(this._);
    const ri = keys[keys.length - 1];
    const col = this._[ri];
    if (col) {
      const { cells } = col;
      const ks = Object.keys(cells);
      const ci = ks[ks.length - 1];
      return [parseInt(ri, 10), parseInt(ci, 10)];
    }
    return [0, 0];
  }

  each(cb) {
    Object.entries(this._).forEach(([ri, row]) => {
      cb(ri, row);
    });
  }

  eachCells(ri, cb) {
    if (this._[ri] && this._[ri].cells) {
      Object.entries(this._[ri].cells).forEach(([ci, cell]) => {
        cb(ci, cell);
      });
    }
  }

  setData(d) {
    if (d.len) {
      this.len = d.len;
      delete d.len;
    }
    this._ = d;
  }

  getData() {
    const { len } = this;
    return Object.assign({ len }, this._);
  }

  static reduceAsRows(iterable, cb = () => {}) {
    const rows = {};
    iterable.forEach(({ ri, ci, cell }) => {
      cb(ri, ci, cell);
      if (!rows[ri]) {
        rows[ri] = { cells: {} };
      }
      if (ci !== undefined && cell) {
        rows[ri].cells[ci] = cell;
      }
    });
    return ({
      rows,
    });
  }
}

export default {};
export {
  Rows,
};
