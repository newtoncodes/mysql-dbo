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
     * @return {Promise.<void>}
     */
    async connect() {
        if (this._connected) return;
        
        await new Promise((resolve, reject) => {
            this._connection.connect((error) => {
                if (error) return reject(error);
                resolve();
            });
        });
    
        if (!this._database) return;
        
        await this.query('USE ' + this._database);
    }

    /**
     * @return {void}
     */
    close() {
        if (this._connection.hasOwnProperty('close')) this._connection.close();
        this._connection = null;
    }
    
    /**
     * @param {string} query
     * @returns {Promise.<void>}
     */
    async query(query) {
        if (!this._connection) throw new Error('Not connected to db');
        
        await new Promise((resolve, reject) => {
            this._connection.query(query, (error) => {
                if (error) return reject(error);
                resolve();
            });
        });
    }
    
    /**
     *
     * @param {string} query
     * @param {string} [key]
     * @param {boolean} [first]
     * @returns {Promise.<*>}
     */
    async select(query, key, first) {
        if (arguments.length === 2) {
            if (typeof arguments[1] === 'string') {
                key = arguments[1];
                first = false;
            } else {
                key = '';
                first = arguments[1];
            }
        }
        
        if (!key || first) {
            let result = await this.query(query);
            return (first ? result[0] : result) || null;
        }
        
        let result = await this.query(query);
        if (!result || !result.length) return [];
        
        let mapped = {};
        result.forEach(row => row && row.hasOwnProperty(key) && (mapped[row[key]] = row));
        
        return mapped;
    }

    /**
     * @param {string} table
     * @param {Object|Array.<Object>} data
     * @param {Array.<string>} [columns]
     * @param {boolean} [ignore]
     * @return {Promise.<number>}
     */
    async insert(table, data, columns, ignore) {
        if (arguments.length === 3) {
            if (typeof arguments[2] === 'object') {
                ignore = false;
                columns = arguments[2];
            } else {
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

        let result = await this.query(query);
        
        return this.getInsertId(result);
    }

    /**
     * @param {string} table
     * @param {Object} data
     * @param {Array.<string>} [columns]
     * @param {string|Object} where
     * @return {Promise.<number>}
     */
    async update(table, data, columns, where) {
        if (arguments.length === 3) {
            where = arguments[2];
            columns = null;
        }

        if (typeof where === 'object') {
            where = Object.keys(where).map(key => '`' + key + '` = ' + this.escape(where[key]) + '').join(' AND ');
        }

        if (!where) throw new Error('Cannot update without a where clause.');

        columns = columns || Object.keys(data || {});

        let query = 'UPDATE `' + table + '` SET ';
        query += columns.map(key => (data[key] === null) ? '`' + key + '` = NULL' : '`' + key + '` = ' + this.escape(data[key])).join(', ');
        query += ' WHERE ' + where;
    
        let result = await this.query(query);

        return this.getAffectedRows(result);
    }

    //noinspection ReservedWordAsName
    /**
     * @param {string} table
     * @param {string|Object} where
     * @return {Promise.<number>}
     */
    async delete(table, where) {
        if (typeof where === 'object') {
            where = Object.keys(where).map(key => '`' + key + '` = ' + this.escape(where[key]) + '').join(' AND ');
        }

        if (!where) throw new Error('Cannot delete without a where clause.');

        let result = await this.query('DELETE FROM `' + table + '` WHERE ' + where);

        return this.getAffectedRows(result);
    }
    
    /**
     * @param {string} table
     * @param {number} id
     * @returns {Promise.<Object|null>}
     */
    async getById(table, id) {
        id = parseInt(id);
        if (isNaN(id)) return null;

        return await this.select('SELECT * FROM ' + table + ' WHERE id = ' + id + ' LIMIT 1', true);
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
        if (result && result.hasOwnProperty('affectedRows') && result['affectedRows']) return result['affectedRows'];
        else return false;
    }
}


module.exports = MySQL;