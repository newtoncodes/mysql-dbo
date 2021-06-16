'use strict';

const EventEmitter = require('events').EventEmitter;
const mysql = require('mysql2');


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

        if (options['pool']) {
            this._pool = mysql.createPool({
                host: this._host,
                port: this._port,
                user: this._user,
                password: this._password,
                database: this._database,

                waitForConnections: options['pool'].hasOwnProperty('waitForConnections') ? options['pool']['waitForConnections'] : true,
                connectionLimit: options['pool'].hasOwnProperty('connectionLimit') ? options['pool']['connectionLimit'] : 10,
                queueLimit: options['pool'].hasOwnProperty('queueLimit') ? options['pool']['queueLimit'] : 0,
            });

            this._pool = this._pool.promise();
        } else if (options['connection']) {
            this._connection = options['connection'];
            if (this._connection.promise) this._connection = this._connection.promise();
            this._connection.on('error', (error) => this.emit('error', error));
        } else {
            this._connection = mysql.createConnection(Object.assign(options || {}, {
                host: this._host,
                port: this._port,
                user: this._user,
                password: this._password,
                database: this._database,
            }));
            this._connection = this._connection.promise();
            this._connection.on('error', (error) => this.emit('error', error));

            this._connection.on('close', () => {
                console.log('CONNECTION CLOSED');
                // TODO: this?
                this.emit('close');
            });
        }
    }

    async end() {
        if (this._pool) {
            await this._pool.end();
        } else {
            await this._connection.end();
        }
    }

    async close() {
        return this.end();
    }

    destroy() {
        if (this._pool) {
            throw new Error('Pools cannot be destroyed. Use end.');
        } else {
            this._connection.destroy();
        }
    }

    /**
     * @returns {Promise<MySQL>}
     */
    async allocateDb() {
        return new MySQL({
            host: this._host,
            port: this._port,
            user: this._user,
            password: this._password,
            database: this._database,

            connection: await this._pool.getConnection(),
        });
    }

    async release() {
        this._connection.release && this._connection.release();
    }
    
    /**
     * @param {string} query
     * @returns {Promise.<void>}
     */
    async query(query) {
        if (!this._pool && !this._connection) throw new Error('Not connected to db');

        let result = null;

        if (this._pool) result = await this._pool.query(query);
        else result = await this._connection.query(query);

        return result[0];
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

        if (this._pool) return this._pool.escape(value + '');
        return this._connection.escape(value + '');
    }

    /**
     * @param {Object} result
     */
    getInsertId(result) {
        if (result && result.hasOwnProperty('insertId') && result.insertId) return result.insertId;
        else return 0;
    }

    /**
     * @param {Object} result
     */
    getAffectedRows(result) {
        if (result && result.hasOwnProperty('affectedRows') && result['affectedRows']) return result['affectedRows'];
        else return 0;
    }
}


module.exports = MySQL;