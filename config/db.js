import {connect} from 'mongoose';


const connectDB = async()=>{

    try{
        await connect(process.env.MONGO_URI   ,{
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName: process.env.DB_NAME || 'trackrxdb',
        })
        console.log("DB connected ");
    }
    catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }

}


export default connectDB;