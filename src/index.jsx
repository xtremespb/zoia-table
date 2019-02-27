import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ZTablePagination from './ZPagination.jsx';
import ZTh from './ZTh.jsx';
import ZSearch from './ZSearch.jsx';
import ZLoading from './ZLoading.jsx';
import './style.css';

const ERR_NONE = 0;
const ERR_VMANDATORY = 1;
const ERR_VFORMAT = 2;

export default class ZTable extends Component {
    state = {
        data: [],
        columns: this.props.columns,
        page: 1,
        checkboxes: {},
        checkboxAllChecked: false,
        currentChunk: [],
        searchText: '',
        total: 0,
        editMode: {
            columnId: null,
            recordId: null,
            value: null,
            loading: false
        },
        values: {},
        validationError: ERR_NONE
    }

    static propTypes = {
        prefix: PropTypes.string.isRequired,
        columns: PropTypes.arrayOf(PropTypes.object).isRequired,
        lang: PropTypes.objectOf(PropTypes.string),
        itemsPerPage: PropTypes.number.isRequired,
        source: PropTypes.objectOf(PropTypes.string),
        save: PropTypes.objectOf(PropTypes.string),
        data: PropTypes.arrayOf(PropTypes.object),
        sortColumn: PropTypes.string,
        sortDirection: PropTypes.string,
        hideColumnID: PropTypes.bool,
        UIkit: PropTypes.func.isRequired,
        axios: PropTypes.func.isRequired
    }

    static defaultProps = {
        hideColumnID: false,
        sortDirection: 'asc',
        sortColumn: '',
        data: [],
        source: {},
        save: {},
        lang: {
            LOADING: 'Loading data, please wait…',
            NO_RECORDS: 'No records to display',
            ERROR_LOAD: 'Could not load data',
            ERROR_SAVE: 'Could not save data',
            ERR_VMANDATORY: 'Field is required',
            ERR_VFORMAT: 'Invalid format'
        }
    }

    constructor(props) {
        super(props);
        this.props.columns.map(c => {
            const cn = c;
            cn.sort = this.props.sortColumn === cn.id ? this.props.sortDirection : null;
            this.state.values[c.id] = {};
        });
        if (props.source.url) {
            this.fetchURL(true);
        } else {
            this.state.data = props.data;
            this.state.total = props.data.length;
            const currentColumn = this.state.columns.find(element => !!element.sort);
            if (currentColumn) {
                const dataSorted = this.state.data.slice(0);
                dataSorted.sort((a, b) => (a[currentColumn.id] > b[currentColumn.id]) ? (currentColumn.sort === 'desc' ? -1 : 1) : ((b[currentColumn.id] > a[currentColumn.id]) ? (currentColumn.sort === 'desc' ? 1 : -1) : 0));
            }
            this.setValuesFromData(this.state.data, true);
        }
    }

    componentDidMount = () => {
        document.addEventListener('keydown', this.onEditModeEscapeBinding);
    }

    setValuesFromData = (data, callFromConstructor) => {
        const currentChunk = this.props.source.url && data.length > this.props.itemsPerPage ? data.slice((this.state.page - 1) * this.props.itemsPerPage, (this.state.page - 1) * this.props.itemsPerPage + parseInt(this.props.itemsPerPage, 10)) : data;
        const valuesSet = {};
        currentChunk.map((item) => {
            this.state.columns.map((col) => {
                let val = item[col.id] || ' ';
                val = col.process && typeof col.process === 'function' ? col.process(item[col.id], item) : val;
                if (col.editable) {
                    valuesSet[col.id] = valuesSet[col.id] || {};
                    valuesSet[col.id][item.id] = val;
                }
            });
        });
        if (callFromConstructor) {
            this.state.values = valuesSet;
        } else {
            this.setState({
                values: valuesSet
            });
        }
    }

    fetchURL(init) {
        if (init) {
            this.state.loading = true;
            this.state.loadingText = true;
        } else {
            this.setState({
                loading: true
            });
        }
        const paramsData = {
            page: this.state.page,
            search: this.state.searchText,
            itemsPerPage: this.props.itemsPerPage,
            sortColumn: this.state.sortColumn || this.props.sortColumn || '',
            sortDirection: this.state.sortDirection || this.props.sortDirection || ''
        };
        this.props.axios({
            method: this.props.source.method,
            url: this.props.source.url,
            responseType: 'json',
            data: paramsData,
            params: this.props.source.method.match(/get/i) ? paramsData : null
        }).then(response => {
            if (response.data.status !== 1) {
                this.setState({
                    error: true,
                    loading: false,
                    loadingText: false,
                    data: []
                });
                return;
            }
            this.setState({
                data: response.data.items,
                total: response.data.total,
                loading: false,
                loadingText: false,
                error: false
            });
            this.setValuesFromData(response.data.items);
        }).catch(() => {
            this.setState({
                error: true,
                loading: false,
                loadingText: false,
                data: []
            });
        });
    }

    saveData(_columnId, _recordId, _value) {
        const paramsData = {
            columnId: _columnId,
            recordId: _recordId,
            value: _value
        };
        this.props.axios({
            method: this.props.save.method,
            url: this.props.save.url,
            responseType: 'json',
            data: paramsData,
            params: this.props.save.method.match(/get/i) ? paramsData : null
        }).then(response => {
            if (response.data.status !== 1) {
                this.props.UIkit.notification(response.data.errorMessage || this.props.lang.ERROR_SAVE, { status: 'danger' });
                this.setState({
                    editMode: {
                        columnId: null,
                        recordId: null,
                        value: null,
                        loading: false
                    }
                });
                return;
            }
            const valuesNew = JSON.parse(JSON.stringify(this.state.values));
            valuesNew[this.state.editMode.columnId][this.state.editMode.recordId] = response.data.value;
            this.setState({
                editMode: {
                    columnId: null,
                    recordId: null,
                    value: null,
                    loading: false
                },
                values: valuesNew
            });
        }).catch(() => {
            this.props.UIkit.notification(this.props.lang.ERROR_SAVE, { status: 'danger' });
            this.setState({
                editMode: {
                    columnId: null,
                    recordId: null,
                    value: null,
                    loading: false
                }
            });
        });
    }

    onCellValueClick = (event, val) => {
        const col = JSON.parse(event.currentTarget.dataset.col);
        if (!col.editable) {
            return;
        }
        const item = JSON.parse(event.currentTarget.dataset.item);
        this.setState({
            editMode: {
                columnId: col.id,
                recordId: item.id,
                value: val,
                loading: false
            },
            validationError: ERR_NONE
        }, () => {
            this[`editField_${col.id}_${item.id}`].focus();
        });
    }

    onEditModeInputBlur = () => {
        this.setState({
            editMode: {
                columnId: null,
                recordId: null
            }
        });
    }

    onEditModeInputKeypress = (event, col) => {
        if (event.key === 'Enter') {
            this.state.editMode.value = this.state.editMode.value.trim();
            if (col.validation) {
                if (col.validation.mandatory && !this.state.editMode.value) {
                    this.setState({
                        validationError: ERR_VMANDATORY
                    });
                    return;
                }
                if (col.validation.regexp && this.state.editMode.value) {
                    const rex = new RegExp(col.validation.regexp);
                    if (!rex.test(this.state.editMode.value)) {
                        this.setState({
                            validationError: ERR_VFORMAT
                        });
                        return;
                    }
                }
            }
            this.setState({
                editMode: {
                    columnId: this.state.editMode.columnId,
                    recordId: this.state.editMode.recordId,
                    value: this.state.editMode.value,
                    loading: true
                }
            }, () => {
                this.saveData(this.state.editMode.columnId, this.state.editMode.recordId, this.state.editMode.value);
            });
        }
    }

    onEditModeInputChange = event => {
        const { value } = event.target;
        const editModeNew = JSON.parse(JSON.stringify(this.state.editMode));
        editModeNew.value = value;
        this.setState({
            editMode: editModeNew
        });
    }

    onEditModeSelectChange = event => {
        const { value } = event.target;
        this.setState({
            editMode: {
                columnId: this.state.editMode.columnId,
                recordId: this.state.editMode.recordId,
                value: value, // eslint-disable-line object-shorthand
                loading: true
            }
        }, () => {
            this.saveData(this.state.editMode.columnId, this.state.editMode.recordId, this.state.editMode.value);
        });
    }

    onEditModeEscapeBinding = event => {
        if (event.key === 'Escape' && this.state.editMode.columnId) {
            this.setState({
                editMode: {
                    columnId: null,
                    recordId: null,
                    value: null,
                    loading: false
                }
            });
        }
    }

    onEditModeSelectKeypress = event => {
        if (event.key === 'Enter') {
            this.onEditModeSelectChange(event);
        }
    }

    getEditableFieldsErrorMessage = code => {
        let msg;
        switch (code) {
            case ERR_VFORMAT:
                msg = this.props.lang.ERR_VFORMAT;
                break;
            default:
                msg = this.props.lang.ERR_VMANDATORY;
        }
        return this.state.validationError !== ERR_NONE ? <div><span className="uk-label uk-label-danger">{msg}</span></div> : null;
    }

    getEditableFields = (col, item) => {
        switch (col.editable) {
            case 'select':
                return (<select onKeyPress={this.onEditModeSelectKeypress} onChange={this.onEditModeSelectChange} value={this.state.values[col.id][item.id]} onBlur={this.onEditModeInputBlur} className="uk-select ztable-editmode-select uk-width-1-1" ref={input => { this[`editField_${col.id}_${item.id}`] = input; }}>{Object.keys(col.options).map(key => (<option key={`editSelectOption_${col.id}_${item.id}_${key}`} value={key}>{col.options[key]}</option>))}</select>);
            default:
                return (<><input ref={input => { this[`editField_${col.id}_${item.id}`] = input; }} type="text" className={`uk-input ztable-editmode-input uk-width-1-1${this.state.validationError !== ERR_NONE ? ' uk-form-danger' : null}`} onChange={this.onEditModeInputChange} value={this.state.editMode.value} onKeyPress={e => this.onEditModeInputKeypress(e, col)} onBlur={this.onEditModeInputBlur} />{this.getEditableFieldsErrorMessage(this.state.validationError)}</>);
        }
    }

    getCell = (col, item, val) => {
        const value = col.editable ? (col.editable === 'select' ? col.options[this.state.values[col.id][item.id]] : this.state.values[col.id][item.id]) : val;
        return (<>{this.state.editMode.loading && this.state.editMode.columnId === col.id && this.state.editMode.recordId === item.id ? <div uk-spinner="ratio:0.5" /> : <div className="ztable-cell" tabIndex={col.editable ? 0 : null} onClick={e => this.onCellValueClick(e, this.state.values[col.id] ? this.state.values[col.id][item.id] : null)} data-col={JSON.stringify(col)} data-item={JSON.stringify(item)} role={col.editable ? 'button' : null}>{value || ' '}</div>}</>); // eslint-disable-line jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-static-element-interactions
    }

    getRows = () => {
        this.state.currentChunk = this.state.data.length > this.props.itemsPerPage ? this.state.data.slice((this.state.page - 1) * this.props.itemsPerPage, (this.state.page - 1) * this.props.itemsPerPage + parseInt(this.props.itemsPerPage, 10)) : this.state.data;
        return this.state.currentChunk.length ? this.state.currentChunk.map((item) => {
            const cells = this.state.columns.map((col) => {
                let val = item[col.id] || ' ';
                val = col.process && typeof col.process === 'function' ? col.process(item[col.id], item) : val;
                return (<td key={`${this.props.prefix}_td_${col.id}`} className={col.cssRow || null}>{!this.state.editMode.loading && this.state.editMode.columnId === col.id && this.state.editMode.recordId === item.id ? this.getEditableFields(col, item) : this.getCell(col, item, val)}</td>);
            });
            const columnID = this.props.hideColumnID ? null : <td className="uk-table-shrink"><input onChange={this.checkboxChangeHandler} className="uk-checkbox" type="checkbox" data-id={item.id} checked={!!this.state.checkboxes[item.id]} /></td>;
            return (<tr key={`${this.props.prefix}_tr_${item.id}`}>{columnID}{cells}</tr>);
        }) : false;
    }

    checkboxChangeHandler = event => {
        const id = event.currentTarget.getAttribute('data-id');
        const { checkboxes } = this.state;
        checkboxes[id] = checkboxes[id] ? null : this.state.currentChunk.find(i => String(i.id) === id);
        Object.keys(checkboxes).map(key => {
            if (!checkboxes[key]) {
                delete checkboxes[key];
            }
        });
        this.setState({
            checkboxes: checkboxes // eslint-disable-line object-shorthand
        });
        this.getCheckboxData();
    }

    checkboxChangeAllHandler = event => {
        const checkboxesNew = {};
        this.state.currentChunk.map(item => checkboxesNew[item.id] = event.currentTarget.checked ? item : null);
        Object.keys(checkboxesNew).map(key => {
            if (!checkboxesNew[key]) {
                delete checkboxesNew[key];
            }
        });
        this.setState({
            checkboxes: checkboxesNew,
            checkboxAllChecked: event.currentTarget.checked
        });
        this.getCheckboxData();
    }

    getCheckboxData = () => {
        const data = Object.keys(this.state.checkboxes).map(key => this.state.checkboxes[key]);
        Object.keys(this.state.values).map(key => {
            data.map((item, i) => {
                data[i][key] = this.state.values[key][item.id] || data[i][key];
            });
        });
        return data;
    }

    pageClickHandler = pageNew => {
        this.setState({
            page: pageNew,
            checkboxes: {},
            checkboxAllChecked: false
        }, () => {
            if (this.props.source.url) {
                this.fetchURL(false);
            }
        });
    }

    thOnClickHandler = event => {
        const id = event.currentTarget.getAttribute('data-id');
        const currentColumn = this.state.columns.find((element) => !!element.sort);
        const clickedColumn = this.state.columns.find((element) => element.id === id);
        if (!clickedColumn.sortable) {
            return;
        }
        let sortDirectionNew;
        const columnsNew = clickedColumn.id === currentColumn.id ? this.state.columns.map(_item => {
            const item = _item;
            item.sort = item.id === currentColumn.id ? item.sort === 'desc' ? 'asc' : 'desc' : item.sort;
            sortDirectionNew = sortDirectionNew || item.sort;
            return item;
        }) : this.state.columns.map(_item => {
            const item = _item;
            item.sort = item.id === clickedColumn.id ? 'desc' : null;
            sortDirectionNew = sortDirectionNew || item.sort;
            return item;
        });
        if (this.props.source.url) {
            this.setState({
                sortColumn: id,
                sortDirection: sortDirectionNew
            }, () => {
                this.fetchURL(false);
            });
        } else {
            const dataSorted = this.state.data.slice(0);
            dataSorted.sort((a, b) => (a[clickedColumn.id] > b[clickedColumn.id]) ? (sortDirectionNew === 'desc' ? -1 : 1) : ((b[clickedColumn.id] > a[clickedColumn.id]) ? (sortDirectionNew === 'desc' ? 1 : -1) : 0));
            this.setState({
                columns: columnsNew,
                data: dataSorted
            });
        }
    }

    onSearchValueChanged = value => {
        if (this.props.source.url) {
            this.setState({
                searchText: value.trim(),
                data: [],
                loadingText: true,
                page: 1
            }, () => {
                this.fetchURL(false);
            });
        } else {
            const dataFiltered = value.length > 0 ? this.props.data.filter(item => {
                const values = Object.values(item);
                return values.find(val => String(val).match(new RegExp(value, 'gim')));
            }) : this.props.data.slice(0);
            this.setState({
                searchText: value.trim(),
                data: dataFiltered,
                total: dataFiltered.length,
                page: 1
            });
        }
    }

    onClickRefreshHandler = e => {
        e.preventDefault();
        this.setState({
            error: false,
            loadingText: true
        });
        this.fetchURL(false);
    }

    render = () => (<div className="ztable-wrap">
        <div uk-grid="true">
            <div className="uk-width-expand@s">
                <ZTablePagination page={this.state.page} totalPages={Math.ceil(this.state.total / this.props.itemsPerPage)} pageClickHandler={this.pageClickHandler} />
            </div>
            <div className="uk-width-auto@s">
                <ZSearch currentSearchInputValue={this.state.currentSearchInputValue} onValueChanged={this.onSearchValueChanged} />
            </div>
        </div>
        <div className="uk-overflow-auto">
            <table className="uk-table uk-table-middle uk-table-small uk-table-striped uk-table-hover">
                <thead>
                    <tr>
                        {this.props.hideColumnID ? null : <th className="uk-table-shrink"><label><input type="checkbox" className="uk-checkbox" checked={this.state.checkboxAllChecked} onChange={this.checkboxChangeAllHandler} /></label></th>}
                        {this.state.columns.map(item => (<ZTh key={item.id} prefix={this.props.prefix} css={item.cssHeader} thid={item.id} title={item.title} sortable={item.sortable} sort={item.sort} thOnClickHandler={this.thOnClickHandler} />))}
                    </tr>
                </thead>
                <tbody>
                    {this.state.loadingText ? <tr><td colSpan="100%">{this.props.lang.LOADING}</td></tr> : this.state.error ? null : this.getRows() || <tr><td colSpan="100%">{this.props.lang.NO_RECORDS}</td></tr>}
                    {this.state.error ? <tr><td colSpan="100%" className="ztable-td-error">{this.props.lang.ERROR_LOAD}&nbsp;<button type="button" onClick={this.onClickRefreshHandler} uk-icon="icon:refresh;ratio:0.8" /></td></tr> : null}
                </tbody>
            </table>
        </div>
        <div uk-grid="true" className="uk-margin-top">
            <div className="uk-width-expand@s">
                <ZTablePagination page={this.state.page} totalPages={Math.ceil(this.state.total / this.props.itemsPerPage)} pageClickHandler={this.pageClickHandler} />
            </div>
            <div className="uk-width-auto@s">
                <ZSearch currentSearchInputValue={this.state.currentSearchInputValue} onValueChanged={this.onSearchValueChanged} />
            </div>
        </div>
        {this.state.loading ? <ZLoading /> : null}
    </div>);
}
