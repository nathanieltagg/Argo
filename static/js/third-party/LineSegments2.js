/**
 * @author WestLangley / http://github.com/WestLangley
 *
 */

THREE.LineSegments2 = function ( geometry, material ) {

	THREE.Mesh.call( this );

	this.type = 'LineSegments2';

	this.geometry = geometry !== undefined ? geometry : new THREE.LineSegmentsGeometry();
	this.material = material !== undefined ? material : new THREE.LineMaterial( { color: Math.random() * 0xffffff } );
};

THREE.LineSegments2.prototype = Object.assign( Object.create( THREE.Mesh.prototype ), {

	constructor: THREE.LineSegments2,

	isLineSegments2: true,

	computeLineDistances: ( function () { // for backwards-compatability, but could be a method of LineSegmentsGeometry...

		var start = new THREE.Vector3();
		var end = new THREE.Vector3();

		return function computeLineDistances() {

			var geometry = this.geometry;

			var instanceStart = geometry.attributes.instanceStart;
			var instanceEnd = geometry.attributes.instanceEnd;
			var lineDistances = new Float32Array( 2 * instanceStart.data.count );

			for ( var i = 0, j = 0, l = instanceStart.data.count; i < l; i ++, j += 2 ) {

				start.fromBufferAttribute( instanceStart, i );
				end.fromBufferAttribute( instanceEnd, i );

				lineDistances[ j ] = ( j === 0 ) ? 0 : lineDistances[ j - 1 ];
				lineDistances[ j + 1 ] = lineDistances[ j ] + start.distanceTo( end );

			}

			var instanceDistanceBuffer = new THREE.InstancedInterleavedBuffer( lineDistances, 2, 1 ); // d0, d1

			geometry.addAttribute( 'instanceDistanceStart', new THREE.InterleavedBufferAttribute( instanceDistanceBuffer, 1, 0 ) ); // d0
			geometry.addAttribute( 'instanceDistanceEnd', new THREE.InterleavedBufferAttribute( instanceDistanceBuffer, 1, 1 ) ); // d1

			return this;

		};

	}() ),

	copy: function ( source ) {

		// todo

		return this;

	}, 
  
	raycast: ( function () {

		var inverseMatrix = new THREE.Matrix4();
		var ray = new THREE.Ray();
		var sphere = new THREE.Sphere();

		return function raycast( raycaster, intersects ) {

			var precision = raycaster.linePrecision;

			var geometry = this.geometry;
			var matrixWorld = this.matrixWorld;

			// Checking boundingSphere distance to ray

			if ( geometry.boundingSphere === null ) geometry.computeBoundingSphere();
			sphere.copy( geometry.boundingSphere );
			sphere.applyMatrix4( matrixWorld );
			sphere.radius += precision;

			if ( raycaster.ray.intersectsSphere( sphere ) === false ) return;

			inverseMatrix.getInverse( matrixWorld );
			ray.copy( raycaster.ray ).applyMatrix4( inverseMatrix );

			var localPrecision = precision / ( ( this.scale.x + this.scale.y + this.scale.z ) / 3 );
			var localPrecisionSq = localPrecision * localPrecision;

			var vStart = new THREE.Vector3();
			var vEnd = new THREE.Vector3();
			var interSegment = new THREE.Vector3();
			var interRay = new THREE.Vector3();

      // Currently, the geometry is lways a LineSegments2 geometry, which uses the instanceStart/instanceEnd to store segment locations
      var starts = geometry.attributes.instanceStart;
      var ends   = geometry.attributes.instanceEnd;
      
      for(var i=0;i<starts.count;i++) {
        vStart.fromArray( starts.data.array, i * starts.data.stride + starts.offset );
        vEnd  .fromArray( ends  .data.array, i * ends  .data.stride + ends  .offset );
        var distSq = ray.distanceSqToSegment( vStart, vEnd, interRay, interSegment );
        
        if ( distSq > localPrecisionSq ) continue;
        
        interRay.applyMatrix4( this.matrixWorld ); //Move back to world space for distance calculation
        
        var distance = raycaster.ray.origin.distanceTo( interRay );
        
        if ( distance < raycaster.near || distance > raycaster.far ) continue;
        
        intersects.push( {
        
          distance: distance,
          // What do we want? intersection point on the ray or on the segment??
          // point: raycaster.ray.at( distance ),
          point: interSegment.clone().applyMatrix4( this.matrixWorld ),
          index: i,
          face: null,
          faceIndex: null,
          object: this
        } );
        if(this.raycast_fast) return; // Hidden feature: setting geometry.raycast_fast=true means it won't match to every segment, just the first segment it happens to find. If you just want to find if it matches any part of this line, this is faster. Default remains to match to all segments that might satisfy the raycast match.
          
      }
		};
  }() )
  
} );
