
rpc.on("user.display",function(socket,data,callback){
	async.waterfall([
		function(cb){ cb(typeof(data)==="object" && data!==null && typeof(data.username)==="string" ? null : "corrupt"); },
		function(cb){ cb(!data.edit || socket.data.auth>=config.adminlevel || (socket.data.user && socket.data.user.username===data.username) ? null : "unauthorized"); },
		function(cb){ database.get("user",{"username":data.username},{},function(e,r){ if(!e && !data.edit) delete r.password; cb(e,r); }); }
	],function(e,r){ callback(e,r); });
});

rpc.on("set.list",function(socket,data,callback){
	database.select("set",{"_id":{"$ne":0}},{},function(e,r){ callback(e,e?null:
		r.filter(function(set){
			return Array.isArray(set._refs.group) && set._refs.group.length>0; })
	); });
});

var verify_groups = function(admin,user,sets,groups){
	var result = [], error = false;
	sets.forEach(function(set){
		if(set.freedom==="1" || admin){
			if(!Array.isArray(groups[set._id]) || set.exclusive==="1" && groups[set._id].length!==1) error = 1;
			else groups[set._id].forEach(function(g){
				if(typeof(g)!=="object" || g===null || typeof(g._id)!=="number") error = 2;
				else if(set._refs.group.indexOf(g._id)===-1) error = 3;
				else result.push(g);
			});
		} else result = result.concat(u.groups.filter(function(g){ return g.set._id===set._id; }));
	});
	return error?error:result;
};

rpc.on("user.create",function(socket,data,callback){
	async.waterfall([
		function(cb){ cb(typeof(data)==="object" && data!==null && typeof(data.groups)==="object" && data.groups!==null ? null : "corrupt"); },
		function(cb){ rpc.emit("set.list",socket,null,function(e,r){ cb(e,e?null:r); }); },
		function(s,cb){
			data.auth = schema.user.auth.default;
			data.groups = verify_groups(socket.data.auth>=config.adminlevel,{groups:[]},s,data.groups);
			if(!Array.isArray(data.groups)){ cb("corrupt:groups"); return; }
			data.$collection = "user";
			cb(null);
		}
	],function(e){ if(e) callback(e); else action.insert(socket,data,callback); });
});

rpc.on("user.modify",function(socket,data,callback){
	async.waterfall([
		function(cb){ cb(typeof(data)==="object" && data!==null && typeof(data._id)==="number" && typeof(data.groups)==="object" && data.groups!==null ? null : "corrupt"); },
		function(cb){ database.get("user",{"_id":parseInt(data._id)},{},function(e,r){ cb(e,e?null:r); }); },
		function(u,cb){ database.select("set",{"_id":{"$ne":0}},{},function(e,r){ cb(e,e?null:u,e?null:r); }); },
		function(u,s,cb){
			if(socket.data.user===null){ cb("unauthorized"); return; }
			if(socket.data.auth<config.adminlevel){
				data.username = u.username;
				data.auth = u.auth;
			} // or else they should be provided
			data.groups = verify_groups(socket.data.auth>=config.adminlevel,u,s,data.groups);
			if(!Array.isArray(data.groups)){ cb("corrupt:groups"); return; }
			data.$collection = "user";
			cb(null);
		}
	],function(e){ if(e) callback(e); else action.update(socket,data,callback); });
});