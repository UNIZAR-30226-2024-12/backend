const { db, closeDb } = require("./ConnectionManager");
const FriendVO = require('./FriendVO');

class FriendDAO {
    async insert(FriendVO) {
        try {
            const query = `INSERT INTO friend (Player_email1, Player_email2) VALUES(?, ?)`; // 1.2.3.4       
            const values = [FriendVO.Player_email1, FriendVO.Player_email2];
            const client = await dbConnect();
            const result = await db.query(query, values);
            return result;
        } catch (error) {
            throw error;
        } finally {
            closeDb(client);
        }
    }

    async selectAll() {
        try {
            const query = `SELECT * FROM friend`;
            const client = await dbConnect();
            const result = await db.query(query);
            return result;
        } catch (error) {
            throw error;
        } finally {
            closeDb(client);
        }
    }
    
    /**
     * @param {string} id - The id of the friend to delete.
     */
    async remove(id) {
        try {
            const query = `DELETE FROM friend WHERE id = ?`;
            const client = await dbConnect();
            const result = await db.query(query, [id]);
            return result;
        } catch (error) {
            throw error;
        } finally {
            closeDb(client);
        }
    }
};

module.exports = FriendDAO;