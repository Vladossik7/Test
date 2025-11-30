import React from 'react';

const MyNewComponent = ({item}) => {
    const user ={
        firstName: 'Test',
        lastName: 'User',
        age: 28
    }
    const userArray = ['Test', 'User'];
    // const userFistName = user.firstName;
    // const userLastName = user.lastName;
    // const userAge = user.age;
    const {firstName, lastName, age} = user;
    const [fName, lName] = userArray;
    console.log(firstName, lastName, age);
    return (
        <div>My New Component content: <b>{item.name} - {item.age}</b></div>
    );
}

export default MyNewComponent;