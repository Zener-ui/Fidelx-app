const { adminClient } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

/**
 * Notifies every user with role='admin'.
 *
 * This exists because four different controllers previously wrote
 * notifications with the literal string "admin" as user_id — since
 * notifications.user_id is TEXT with no foreign key, that insert never
 * errored, but it also never matched any real admin's actual user_id
 * (a UUID), so those notifications were permanently invisible to
 * everyone. This queries real admin accounts and notifies each one.
 */
const notifyAdmins = async (title, body) => {
  const { data: admins } = await adminClient.from("users").select("id").eq("role", "admin");
  if (!admins?.length) return;

  await adminClient.from("notifications").insert(
    admins.map((admin) => ({
      id: uuidv4(),
      user_id: admin.id,
      title,
      body,
      is_read: false,
    }))
  );
};

module.exports = { notifyAdmins };
