'use strict';

const MySQL = require('../src/MySQL');

let dbo = new MySQL({
    host: 'localhost',
    port: 3306,
    database: 'test',
    user: 'root',
    password: ''
});


dbo.connect(() => {
    // Misc query
    dbo.query('SHOW CREATE TABLE users', (error, result) => {
        console.log('Test 1:', error, result);
    });

    // Normal select
    dbo.select('SELECT * FROM users LIMIT 10', (error, users) => {
        console.log('Test 2:', error, users);
    });

    // Return an object with the id column as key
    dbo.select('SELECT * FROM users LIMIT 10', 'id', (error, users) => {
        console.log('Test 3:', error, users);
    });

    // Select first row of the result
    dbo.select('SELECT * FROM users LIMIT 1', true, (error, user) => {
        console.log('Test 4:', error, user);
    });

    // Insert one row
    dbo.insert('users', {name: 'test1', email: 'test1@test.com'}, (error, insertId) => {
        console.log('Test 5:', error, insertId);
    });

    // Insert many
    dbo.insert('users', [
        {name: 'test2', email: 'test2@test.com'},
        {name: 'test3', email: 'test3@test.com'}
    ], (error, insertId) => {
        console.log('Test 6:', error, insertId);
    });

    // Insert one row with explicit columns
    dbo.insert('users', {skip: Math.random(), name: 'test4', email: 'test5@test.com'}, ['name', 'email'], (error, insertId) => {
        console.log('Test 7:', error, insertId);
    });

    // Insert many with explicit columns
    dbo.insert('users', [
        {skip: Math.random(), name: 'test5', email: 'test5@test.com'},
        {skip: Math.random(), name: 'test6', email: null}
    ], ['name', 'email'], (error, insertId) => {
        console.log('Test 8:', error, insertId);
    });

    // Full insert
    dbo.insert(
        'users',
        [
            {random: Math.random(), name: 'test7', email: 'test7@test.com'},
            {random: Math.random(), name: 'test8', email: 'test8@test.com'}
        ],
        ['name', 'email'],
        false,
        (error, insertId) => {
            console.log('Test 9:', error, insertId);
        }
    );

    // Full insert IGNORE with explicit columns
    dbo.insert(
        'users',
        [
            {random: Math.random(), name: 'test9', email: 'test9@test.com'},
            {random: Math.random(), name: 'test10', email: 'test10@test.com'}
        ],
        ['name', 'email'],
        true,
        (error, insertId) => {
            console.log('Test 10:', error, insertId);
        }
    );

    // Another insert test
    dbo.insert('users', [
        {name: 'test99', email: 'test99@test.com'},
        {name: 'test999', email: 'test999@test.com'},
        {name: 'test999', email: 'test999@test.com'},
        {name: 'test999', email: 'test999@test.com'},
        {name: 'test999', email: 'test999@test.com'},
        {name: 'test999', email: 'test999@test.com'},
        {name: 'test999', email: 'test999@test.com'}
    ]);

    // Update row
    dbo.update('users', {name: 'test1111', email: 'test1111@test.com'}, 'id = 1', (error, affectedRows) => {
        console.log('Test 11:', error, affectedRows);
    });

    // Update row with explicit columns
    dbo.update('users', {skip: Math.random(), name: 'test5555', email: 'test5555@test.com'}, ['name', 'email'], 'id = 5', (error, affectedRows) => {
        console.log('Test 13:', error, affectedRows);
    });

    // Update with object where (checked with = and joined with AND)
    dbo.update(
        'users',
        {random: Math.random(), name: null, email: null},
        ['name', 'email'],
        {id: 9},
        (error, affectedRows) => {
            console.log('Test 16:', error, affectedRows);
        }
    );

    // Normal delete
    dbo.delete('users', 'id = 10', (error, deletedRows) => {
        console.log('Test 17:', error, deletedRows);
    });

    // Delete with object where (checked with = and joined with AND)
    dbo.delete('users', {id: 9}, (error, deletedRows) => {
        console.log('Test 18:', error, deletedRows);
    });
});