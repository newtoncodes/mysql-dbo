'use strict';

const Driver = require('mysql');
const EventEmitter = require('events').EventEmitter;


class MySQL extends EventEmitter {
    /**
     * @param {Object} [options]
     */
    constructor(options = {}) {
        super();

        this._host = options['host'] || '127.0.0.1';
        this._port = options['port'] || 3306;
        this._user = options['user'] || 'root';
        this._password = options['password'] || '';
        this._database = options['database'] || null;

        this._connected = false;

        this._connection = Driver.createConnection({
            host: this._host,
            port: this._port,
            user: this._user,
            password: this._password
        });

        this._connection.on('error', (error) => this.emit('error', error));
        this._connection.on('close', () => {
            this.emit('close');
            this._connected = false;
        });
    }

    /**
     * @param {function} [callback]
     * @return {MySQL}
     */
    connect(callback) {
        if (!this._connected) this._connection.connect(error => {
            if (error) return callback && callback(error);
            if (!this._database) return callback && callback(null);

            this.query('USE ' + this._database, callback);
        });

        return this;
    }

    /**
     * @return {MySQL}
     */
    close() {
        if (this._connection.hasOwnProperty('close')) this._connection.close();
        this._connection = null;

        return this;
    }

    /**
     * @param {string} query
     * @param {function} [callback]
     * @return {MySQL}
     */
    query(query, callback) {
        if (!this._connection) return callback && callback(new Error('Not connected to db'));
        this._connection.query(query, callback || (() => {}));

        return this;
    }

    /**
     * @param {string} query
     * @param {string} [key]
     * @param {boolean} [first]
     * @param {function} [callback]
     * @return {MySQL}
     */
    select(query, key, first, callback) {
        if (arguments.length === 3) {
            if (typeof arguments[2] === 'function') {
                callback = arguments[2];

                if (typeof arguments[1] === 'string') {
                    key = arguments[1];
                    first = false;
                } else {
                    key = '';
                    first = arguments[1];
                }
            }
        } else if (arguments.length === 2) {
            if (typeof arguments[1] === 'function') {
                callback = arguments[1];
                key = '';
                first = false;
            } else if (typeof arguments[1] === 'string') {
                callback = null;
                key = arguments[1];
                first = false;
            } else {
                callback = null;
                key = '';
                first = arguments[1];
            }
        }

        if (!key || first) return this.query(query, (error, result) => {
            if (error) return callback && callback(error);
            callback && callback(null, (first ? result[0] : result) || null);
        });

        this.query(query, (error, result) => {
            if (error) return callback && callback(error);
            if (!result || !result.length) return callback && callback(null, []);

            let mapped = {};
            result.forEach(row => row && row.hasOwnProperty(key) && (mapped[row[key]] = row));

            callback && callback(null, mapped);
        });

        return this;
    }

    /**
     * @param {string} table
     * @param {Object|Array.<Object>} data
     * @param {Array.<string>} [columns]
     * @param {boolean} [ignore]
     * @param {function} [callback]
     * @return {MySQL}
     */
    insert(table, data, columns, ignore, callback) {
        if (arguments.length === 4) {
            if (typeof arguments[3] === 'function') {
                callback = arguments[3];
                ignore = false;

                if (typeof arguments[2] !== 'object') {
                    ignore = arguments[2];
                    columns = null;
                }
            }
        } else if (arguments.length === 3) {
            if (typeof arguments[2] === 'function') {
                callback = arguments[2];
                ignore = false;
                columns = null;
            } else if (typeof arguments[2] === 'object') {
                callback = null;
                ignore = false;
                columns = arguments[2];
            } else {
                callback = null;
                ignore = arguments[2];
                columns = null;
            }
        }

        if (!Array.isArray(data)) data = [data];
        columns = columns || Object.keys(data[0] || {});

        if (!columns.length) throw new Error('No columns set.');

        let query = 'INSERT' + (ignore ? ' IGNORE' : '') + ' INTO `' + table + '` ';
        query += '(' + columns.map(key => '`' + key + '`').join(', ') + ') VALUES ';
        query += data.map(row => '(' + columns.map(key => row[key] === null ? 'NULL' : this.escape(row[key])).join(', ') + ')').join(', ');

        this.query(query, (error, result) => {
            if (error) return callback && callback(error);
            callback && callback(null, this.getInsertId(result));
        });

        return this;
    }

    /**
     * @param {string} table
     * @param {Object} data
     * @param {Array.<string>} [columns]
     * @param {string|Object} where
     * @param {function} [callback]
     * @return {MySQL}
     */
    update(table, data, columns, where, callback) {
        if (arguments.length === 4 && typeof arguments[3] === 'function') {
            callback = arguments[3];
            where = arguments[2];
            columns = null;
        } else if (arguments.length === 3) {
            where = arguments[2];
            callback = null;
            columns = null;
        }

        if (typeof where === 'object') {
            where = Object.keys(where).map(key => '`' + key + '` = ' + this.escape(where[key]) + '').join(' AND ');
        }

        if (!where) return callback && callback(new Error('Cannot update without a where clause.'));

        columns = columns || Object.keys(data || {});

        let query = 'UPDATE `' + table + '` SET ';
        query += columns.map(key => (data[key] === null) ? '`' + key + '` = NULL' : '`' + key + '` = ' + this.escape(data[key])).join(', ');
        query += ' WHERE ' + where;

        this.query(query, (error, result) => {
            if (error) return callback && callback(error);
            callback && callback(null, this.getAffectedRows(result));
        });

        return this;
    }

    //noinspection ReservedWordAsName
    /**
     * @param {string} table
     * @param {string|Object} where
     * @param {function} callback
     * @return {MySQL}
     */
    delete(table, where, callback) {
        if (typeof where === 'object') {
            where = Object.keys(where).map(key => '`' + key + '` = ' + this.escape(where[key]) + '').join(' AND ');
        }

        if (!where) return callback && callback(new Error('Cannot delete without a where clause.'));

        this.query('DELETE FROM `' + table + '` WHERE ' + where, (error, result) => {
            if (error) return callback && callback(error);
            callback && callback(null, this.getAffectedRows(result));
        });

        return this;
    }

    /**
     * @param {string} table
     * @param {number} id
     * @param {function} callback
     */
    getById(table, id, callback) {
        id = parseInt(id);
        if (isNaN(id)) return callback && callback(null, null);

        return this.selectRow('SELECT * FROM ' + table + ' WHERE id = ' + id + ' LIMIT 1', callback);
    }

    /**
     * @param {*} value
     * @returns {string}
     */
    escape(value) {
        if (value instanceof Date) {
            value = value.getUTCFullYear() + '-' +
                ('00' + (value.getUTCMonth()+1)).slice(-2) + '-' +
                ('00' + value.getUTCDate()).slice(-2) + ' ' +
                ('00' + value.getUTCHours()).slice(-2) + ':' +
                ('00' + value.getUTCMinutes()).slice(-2) + ':' +
                ('00' + value.getUTCSeconds()).slice(-2);
        }

        return this._connection.escape(value + '');
    }

    /**
     * @param {Object} result
     */
    getInsertId(result) {
        if (result && result.hasOwnProperty('insertId') && result.insertId) return result.insertId;
        else return false;
    }

    /**
     * @param {Object} result
     */
    getAffectedRows(result) {
        if (result && result.hasOwnProperty('affectedRows') && result.affectedRows) return result.affectedRows;
        else return false;
    }
}


module.exports = MySQL;