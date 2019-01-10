import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ZTablePagination from './ZPagination.jsx';
import ZTh from './ZTh.jsx';
import ZSearch from './ZSearch.jsx';
import ZLoading from './ZLoading.jsx';
import './style.css';

export default class ZTable extends Component {
    state = {
        data: [],
        columns: this.props.columns,
        page: 1,
        checkboxes: {},
        checkboxAllChecked: false,
        currentChunk: [],
        searchText: '',
        total: 0
    }

    static propTypes = {
        prefix: PropTypes.string.isRequired,
        columns: PropTypes.arrayOf(PropTypes.object).isRequired,
        lang: PropTypes.objectOf(PropTypes.string),
        itemsPerPage: PropTypes.number.isRequired,
        source: PropTypes.objectOf(PropTypes.string),
        data: PropTypes.arrayOf(PropTypes.object),
        debug: PropTypes.bool,
        sortColumn: PropTypes.string,
        sortDirection: PropTypes.string,
        hideColumnID: PropTypes.bool
    }

    static defaultProps = {
        hideColumnID: false,
        sortDirection: 'asc',
        sortColumn: '',
        data: [],
        debug: false,
        source: {},
        lang: {
            LOADING: 'Loading data, please wait…',
            NO_RECORDS: 'No records to display',
            ERROR: 'Could not load data'
        }
    }

    constructor(props) {
        super(props);
        this.props.columns.map(c => {
            const cn = c;
            cn.sort = this.props.sortColumn === cn.id ? this.props.sortDirection : null;
        });
        if (props.source) {
            this.fetchURL(true);
        } else {
            this.state.data = props.data;
            this.state.total = props.data.length;
            const currentColumn = this.state.columns.find(element => !!element.sort);
            if (currentColumn) {
                const dataSorted = this.state.data.slice(0);
                dataSorted.sort((a, b) => (a[currentColumn.id] > b[currentColumn.id]) ? (currentColumn.sort === 'desc' ? -1 : 1) : ((b[currentColumn.id] > a[currentColumn.id]) ? (currentColumn.sort === 'desc' ? 1 : -1) : 0));
            }
        }
    }

    encodeQueryString = params => {
        const keys = Object.keys(params);
        return keys.length ? `?${keys.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&')}` : '';
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
        const params = {
            page: this.state.page,
            search: this.state.searchText,
            itemsPerPage: this.props.itemsPerPage,
            sortColumn: this.state.sortColumn || this.props.sortColumn || '',
            sortDirection: this.state.sortDirection || this.props.sortDirection || ''
        };
        fetch(`${this.props.source.url}${this.props.source.method === 'GET' ? this.encodeQueryString(params) : ''}`, {
            method: this.props.source.method,
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'same-origin',
            redirect: 'follow',
            referrer: 'no-referrer',
            body: this.props.source.method === 'POST' ? JSON.stringify(params) : null,
        }).then(response => {
            response.json()
                .then(data => {
                    this.setState({
                        data: data.items,
                        total: data.total,
                        loading: false,
                        loadingText: false,
                        error: false
                    });
                })
                .catch(error => {
                    if (this.props.debug) {
                        console.log(error);
                    }
                    this.setState({
                        error: true,
                        loading: false,
                        loadingText: false,
                        data: []
                    });
                });
        }).catch(error => {
            if (this.props.debug) {
                console.log(error);
            }
            this.setState({
                error: true,
                loading: false,
                loadingText: false,
                data: []
            });
        });
    }

    getRows() {
        this.state.currentChunk = this.state.data.length > this.props.itemsPerPage ? this.state.data.slice((this.state.page - 1) * this.props.itemsPerPage, (this.state.page - 1) * this.props.itemsPerPage + parseInt(this.props.itemsPerPage, 10)) : this.state.data;
        return this.state.currentChunk.length ? this.state.currentChunk.map((item) => {
            const cells = this.state.columns.map((col) => {
                let val = item[col.id] || '';
                val = col.process && typeof col.process === 'function' ? col.process(item[col.id], item) : val;
                return <td key={`${this.props.prefix}_td_${col.id}`} className={col.cssRow || ''}>{val}</td>;
            });
            const columnID = this.props.hideColumnID ? '' : <td><input onChange={this.checkboxChangeHandler} className="uk-checkbox" type="checkbox" data-id={item.id} checked={!!this.state.checkboxes[item.id]} /></td>;
            return <tr key={`${this.props.prefix}_tr_${item.id}`}>{columnID}{cells}</tr>;
        }) : false;
    }

    checkboxChangeHandler = event => {
        const id = event.currentTarget.getAttribute('data-id');
        const { checkboxesNew } = this.state;
        checkboxesNew[id] = !checkboxesNew[id];
        this.setState({
            checkboxes: checkboxesNew
        });
    }

    checkboxChangeAllHandler = event => {
        const checkboxesNew = {};
        this.state.currentChunk.map(item => checkboxesNew[item.id] = event.currentTarget.checked);
        this.setState({
            checkboxes: checkboxesNew,
            checkboxAllChecked: event.currentTarget.checked
        });
    }

    pageClickHandler = pageNew => {
        this.setState({
            page: pageNew,
            checkboxes: {},
            checkboxAllChecked: false
        }, () => {
            if (this.props.source) {
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
        if (this.props.source) {
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
        if (this.props.source) {
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

    render = () => <div className="ztable-wrap">
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
                        {this.state.columns.map(item => (<ZTh key={item.id} prefix={this.props.prefix} css={item.css} thid={item.id} title={item.title} sortable={item.sortable} sort={item.sort} thOnClickHandler={this.thOnClickHandler} />))}
                    </tr>
                </thead>
                <tbody>
                    {this.state.loadingText ? <tr><td colSpan="100%">{this.props.lang.LOADING}</td></tr> : this.state.error ? null : this.getRows() || <tr><td colSpan="100%">{this.props.lang.NO_RECORDS}</td></tr>}
                    {this.state.error ? <tr><td colSpan="100%" className="ztable-td-error">{this.props.lang.ERROR}&nbsp;<button type="button" onClick={this.onClickRefreshHandler} uk-icon="icon:refresh;ratio:0.8" /></td></tr> : null}
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
    </div>;
}
