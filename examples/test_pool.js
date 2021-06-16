'use strict';

const MySQL = require('../src/MySQL');

let dbo = new MySQL({
    host: 'localhost',
    port: 3306,
    database: 'test',
    user: 'root',
    password: '',

    pool: true,
});


const main = async () => {
    // dbo = await dbo.allocateDb();

    // Misc query
    let result = await dbo.query('SHOW CREATE TABLE users');
    console.log('Test 1:', result);

    // Normal select
    let users = await dbo.select('SELECT * FROM users LIMIT 10');
    console.log('Test 2:', users);

    // Return an object with the id column as key
    users = await dbo.select('SELECT * FROM users LIMIT 10', 'id');
    console.log('Test 3:', users);

    // Select first row of the result
    let user = await dbo.select('SELECT * FROM users LIMIT 1', true);
    console.log('Test 4:', user);

    // Insert one row
    let insertId = await dbo.insert('users', {name: 'test1', email: 'test1@test.com'});
    console.log('Test 5:', insertId);

    // Insert many
    insertId = await dbo.insert('users', [
        {name: 'test2', email: 'test2@test.com'},
        {name: 'test3', email: 'test3@test.com'}
    ]);
    console.log('Test 6:', insertId);

    // Insert one row with explicit columns
    insertId = await dbo.insert('users', {skip: Math.random(), name: 'test4', email: 'test5@test.com'}, ['name', 'email']);
    console.log('Test 7:', insertId);

    // Insert many with explicit columns
    insertId = await dbo.insert('users', [
        {skip: Math.random(), name: 'test5', email: 'test5@test.com'},
        {skip: Math.random(), name: 'test6', email: null}
    ], ['name', 'email']);
    console.log('Test 8:', insertId);

    // Full insert
    insertId = await dbo.insert(
        'users',
        [
            {random: Math.random(), name: 'test7', email: 'test7@test.com'},
            {random: Math.random(), name: 'test8', email: 'test8@test.com'}
        ],
        ['name', 'email'],
        false
    );
    console.log('Test 9:', insertId);

    // Full insert IGNORE with explicit columns
    insertId = await dbo.insert(
        'users',
        [
            {random: Math.random(), name: 'test9', email: 'test9@test.com'},
            {random: Math.random(), name: 'test10', email: 'test10@test.com'}
        ],
        ['name', 'email'],
        true
    );
    console.log('Test 10:', insertId);

    // Another insert test
    await dbo.insert('users', [
        {name: 'test99', email: 'test99@test.com'},
        {name: 'test999', email: 'test999@test.com'},
        {name: 'test999', email: 'test999@test.com'},
        {name: 'test999', email: 'test999@test.com'},
        {name: 'test999', email: 'test999@test.com'},
        {name: 'test999', email: 'test999@test.com'},
        {name: 'test999', email: 'test999@test.com'}
    ]);

    // Update row
    let affectedRows = await dbo.update('users', {name: 'test1111', email: 'test1111@test.com'}, 'id = 1');
    console.log('Test 11:', affectedRows);

    // Update row with explicit columns
    affectedRows = await dbo.update('users', {skip: Math.random(), name: 'test5555', email: 'test5555@test.com'}, ['name', 'email'], 'id = 5');
    console.log('Test 13:', affectedRows);

    // Update with object where (checked with = and joined with AND)
    affectedRows = await dbo.update(
        'users',
        {random: Math.random(), name: null, email: null},
        ['name', 'email'],
        {id: 9}
    );
    console.log('Test 16:', affectedRows);

    // Normal delete
    let deletedRows = await dbo.delete('users', 'id = 10');
    console.log('Test 17:', deletedRows);

    // Delete with object where (checked with = and joined with AND)
    deletedRows = await dbo.delete('users', {id: 9});
    console.log('Test 18:', deletedRows);

    await dbo.end();
};

main().then(() => {
    console.log();
    console.log('Done.');
}).catch(e => {
    console.error(e);
});
