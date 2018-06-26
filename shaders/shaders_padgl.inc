<!-- vertex shader -->
<script id="vertex-shader-1" type="x-shader/x-vertex">
  attribute vec3 vertexPos; 
  uniform mat4 modelViewMatrix; 
  uniform mat4 projectionMatrix;
  void main(void) {
    // Return the transformed and projected vertex value
    gl_Position = projectionMatrix * modelViewMatrix *
          vec4(vertexPos, 1.0);
  }
</script>



<script id="fragment-shader-1" type="x-shader/x-fragment">
void main(void) {
   // Return the pixel color: always output white
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
</script>

