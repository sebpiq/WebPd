/***
 	A very basic implementation of Pd for the web
	Copyright Chris McCormick, 2010
	Licensed under the terms of the LGPLv3.
***/

var Pd = function Pd() {
	// from http://ajaxpatterns.org/On-Demand_Javascript
	/** Include an external javascript file. **/
	this.load = function (url, callback) {
		var callback = callback;
		var body = document.getElementsByTagName("body")[0];
		var contents = document.createElement('iframe');
		contents.style.visibility = 'hidden';
		contents.style.display = 'none';
		contents.src = url;
		contents.pd = this;
		contents.onload = function () { alert(this.pd); }
		body.appendChild(contents);
	}
};
window.Pd = Pd;
